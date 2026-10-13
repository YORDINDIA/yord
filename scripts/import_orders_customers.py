#!/usr/bin/env python3
"""
Import Shopify customers, orders, line items, transactions and courier
fulfillment data (from data/shopify/*.csv) into Supabase.

Data files (repo-relative, overridable per source):
  customers_export.csv    -> customers + customer_addresses
  orders_export_1.csv     -> orders + addresses + line items + discount codes
  Downloaded_Orders.csv   -> fulfillments (courier/AWB fuzzy-join)

Steps: customers -> auth -> orders -> transactions -> fulfillments.
All steps are idempotent upserts; re-running is safe. Completed steps are
recorded in a checkpoint so a re-run skips them.

Before the first write of a run a rollback snapshot of the touched tables is
written to the snapshot dir (one file per run, never overwritten):
  import_orders_customers_snapshot-<timestamp>.json

Two further outputs are written to the working directory (cwd):
  import_orders_customers_unmatched_courier.csv
      Courier rows that fuzzy-matched no order (customer names, mobiles and
      pincodes, for manual follow-up) -- written on --execute only when any
      row goes unmatched. Contains customer PII: gitignored, never commit.
  import_orders_customers_errors.json
      Per-row write errors from the orders step -- written only when a row
      fails to upsert.

Undoes are manual: delete the imported ids (see the snapshot), or use
  python import_orders_customers.py --rollback <snapshot.json>

Usage:
  python import_orders_customers.py              # dry-run (default, counts only)
  python import_orders_customers.py --execute    # write
  python import_orders_customers.py --steps customers,orders
  python import_orders_customers.py --rollback import_orders_customers_snapshot-20261003-120000.json
"""

import argparse
import csv
import hashlib
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from utils.checkpoint import load_checkpoint, mark_entity_done
from utils.cli import configure_logging, create_parser, resolve_execute
from utils.supabase_helpers import get_supabase_client, get_supabase_count

load_dotenv()

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "shopify"
CUSTOMERS_CSV = DATA_DIR / "customers_export.csv"
ORDERS_CSV = DATA_DIR / "orders_export_1.csv"
COURIER_CSV = DATA_DIR / "Downloaded_Orders.csv"

CHECKPOINT_FILE = "import_orders_customers_checkpoint.json"
SNAPSHOT_PREFIX = "import_orders_customers_snapshot-"

STEP_CUSTOMERS = "customers"
STEP_AUTH = "auth"
STEP_ORDERS = "orders"
STEP_TRANSACTIONS = "transactions"
STEP_FULFILLMENTS = "fulfillments"
ALL_STEPS = [STEP_CUSTOMERS, STEP_AUTH, STEP_ORDERS, STEP_TRANSACTIONS, STEP_FULFILLMENTS]
SNAPSHOT_TABLES = ["customers", "customer_addresses", "orders", "line_items",
                   "transactions", "fulfillments", "discount_codes", "order_discount_codes"]

# Synthetic ids are offset far from any Shopify-generated id (<=13 digits) so
# a real id can never collide with these.
CUSTOMER_STUB_BASE = 9_000_000_000_000_000      # order emails with no customer record
LINE_ITEM_ID_BASE = 4_000_000_000_000_000       # legacy orders have no numeric Shopify id
CUST_ADDR_ID_BASE = 8_000_000_000_000_000       # customer default addresses (id = base + customer_id)
ORDER_STUB_BASE = 3_000_000_000_000_000         # legacy orders with only a Name like #YORD...
FULFILLMENT_ID_BASE = 5_000_000_000_000_000
TRANSACTION_ID_BASE = 7_000_000_000_000_000
DISCOUNT_CODE_ID_BASE = 6_000_000_000_000_000


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def parse_ts(value: str | None) -> str | None:
    """Shopify CSV timestamp ('YYYY-MM-DD HH:MM:SS +0530') -> UTC ISO, or None."""
    if not value:
        return None
    m = re.match(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*([+-]\d{4})?$", (value or "").strip())
    if not m:
        return None
    try:
        iso = f"{m.group(1)}{'+' + m.group(2)[0] + m.group(2)[1:3] + ':' + m.group(2)[3:] if m.group(2) else '+00:00'}"
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


def parse_money(value: str | None, default: float | None = None) -> float | None:
    try:
        s = (value or "").strip().replace(",", "")
        return float(s) if s else default
    except (ValueError, TypeError):
        return default


def parse_bool(value: str | None) -> bool:
    return (value or "").strip().lower() == "true"


def clean(value: str | None) -> str | None:
    s = (value or "").strip()
    return s or None


# ---------------------------------------------------------------------------
# CSV loading
# ---------------------------------------------------------------------------

def read_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_customers() -> list[dict]:
    rows = read_csv(CUSTOMERS_CSV)
    out = []
    for r in rows:
        cid = (r.get("Customer ID") or "").strip().lstrip("'")
        if not cid:
            continue
        try:
            cid = int(cid)
        except ValueError:
            continue
        out.append({
            "id": cid,
            "email": clean(r.get("Email")),
            "first_name": clean(r.get("First Name")),
            "last_name": clean(r.get("Last Name")),
            "phone": clean(r.get("Phone")),
            "accepts_marketing": (r.get("Accepts Email Marketing") or "").strip().lower() == "yes",
            "accepts_sms": (r.get("Accepts SMS Marketing") or "").strip().lower() == "yes",
            "tax_exempt": (r.get("Tax Exempt") or "").strip().lower() == "yes",
            "total_spent": parse_money(r.get("Total Spent"), 0.0),
            "orders_count": int(parse_money(r.get("Total Orders"), 0) or 0),
            "note": clean(r.get("Note")),
            "tags": clean(r.get("Tags")),
            "address": {
                "company": clean(r.get("Default Address Company")),
                "address1": clean(r.get("Default Address Address1")),
                "address2": clean(r.get("Default Address Address2")),
                "city": clean(r.get("Default Address City")),
                "province_code": clean(r.get("Default Address Province Code")),
                "country_code": clean(r.get("Default Address Country Code")),
                "zip": clean(r.get("Default Address Zip")),
                "phone": clean(r.get("Default Address Phone")),
            },
        })
    return out


def load_orders() -> list[dict]:
    """Group order_export CSV rows by order Id (fallback Name)."""
    rows = read_csv(ORDERS_CSV)
    by_id: dict[str, dict] = {}
    for r in rows:
        key = clean(r.get("Id")) or clean(r.get("Name"))
        if not key:
            continue
        o = by_id.setdefault(key, {
            "_id": key,
            "line_items": [],
            "order_number": None,
            "email": None, "phone": None,
            "financial_status": None, "fulfillment_status": None,
            "cancelled_at": None, "currency": None,
            "subtotal": None, "shipping": None, "taxes": None, "total": None,
            "discount_code": None, "discount_amount": None,
            "created_at": None, "paid_at": None, "notes": None,
            "payment_method": None, "payment_reference": None,
            "payment_id": None, "refunded_amount": None,
            "billing": {}, "shipping_addr": {},
        })
        m = re.match(r"#+?YORD\d*(\d+)", key)
        if m:
            o["order_number"] = int(m.group(1))
        o.setdefault("_all_rows", []).append(r)
        for src, dst in [
            ("Email", "email"), ("Phone", "phone"),
            ("Financial Status", "financial_status"),
            ("Fulfillment Status", "fulfillment_status"),
            ("Cancelled at", "cancelled_at"),
            ("Currency", "currency"),
            ("Discount Code", "discount_code"),
            ("Created at", "created_at"),
            ("Paid at", "paid_at"),
            ("Notes", "notes"),
            ("Payment Method", "payment_method"),
            ("Payment Reference", "payment_reference"),
            ("Payment ID", "payment_id"),
        ]:
            if o[dst] is None:
                o[dst] = clean(r.get(src))
        for src, dst in [("Subtotal", "subtotal"), ("Shipping", "shipping"),
                         ("Taxes", "taxes"), ("Total", "total"),
                         ("Discount Amount", "discount_amount")]:
            if o[dst] is None:
                o[dst] = parse_money(r.get(src))
        for field in ["Name", "Street", "Address1", "Address2", "Company",
                      "City", "Zip", "Province", "Country", "Phone"]:
            b = clean(r.get(f"Billing {field}"))
            s = clean(r.get(f"Shipping {field}"))
            if field == "Name":
                if o["billing"].get("first_name") is None and b:
                    o["billing"]["first_name"] = b
                if o["shipping_addr"].get("first_name") is None and s:
                    o["shipping_addr"]["first_name"] = s
            else:
                if b and o["billing"].get(field.lower()) is None:
                    o["billing"][field.lower()] = b
                if s and o["shipping_addr"].get(field.lower()) is None:
                    o["shipping_addr"][field.lower()] = s
        title = clean(r.get("Lineitem name"))
        if title:
            o["line_items"].append({
                "title": title,
                "quantity": int(parse_money(r.get("Lineitem quantity"), 1) or 1),
                "price": parse_money(r.get("Lineitem price")),
                "sku": clean(r.get("Lineitem sku")),
                "requires_shipping": parse_bool(r.get("Lineitem requires shipping")),
                "taxable": parse_bool(r.get("Lineitem taxable")),
                "fulfillment_status": clean(r.get("Lineitem fulfillment status")),
            })
    orders = []
    for key, o in by_id.items():
        o.pop("_all_rows", None)
        oid = int(key) if key.isdigit() else None
        o["shopify_id"] = oid
        # legacy orders (Name only, no numeric Id): deterministic synthetic id
        if oid is None:
            o["shopify_id"] = ORDER_STUB_BASE + int(hashlib.md5(key.encode()).hexdigest()[:6], 16)
        # line-item ids need the numeric order id
        for idx, li in enumerate(o["line_items"]):
            base = oid if oid is not None else None
            li["id"] = LINE_ITEM_ID_BASE + (base if base is not None else o["shopify_id"]) * 1000 + idx
            li["li_index"] = idx
        orders.append(o)
    return orders


def load_courier() -> list[dict]:
    if not os.path.exists(COURIER_CSV):
        return []
    rows = read_csv(COURIER_CSV)
    out = []
    for r in rows:
        def cv(key: str) -> str | None:
            s = clean(r.get(key))
            return s.lstrip("'") if s else None
        out.append({
            "date": clean(r.get("Order Date")),
            "order_id": clean(r.get("Order ID")),
            "channel": clean(r.get("Channel")),
            "courier": clean(r.get("Courier Name")),
            "awb_date": clean(r.get("AWB Date")),
            "awb_no": cv("AWB No."),
            "product_details": clean(r.get("Product Details")),
            "payment_method": clean(r.get("Payment Method")),
            "value": parse_money(r.get("Order Value")),
            "status": clean(r.get("Order Status")),
            "customer_name": clean(r.get("Customer Name")),
            "customer_email": clean(r.get("Customer Email")),
            "customer_mobile": cv("Customer Mobile1"),
            "city": clean(r.get("Customer City")),
            "pincode": cv("Customer Pincode"),
        })
    return out


# ---------------------------------------------------------------------------
# Upsert helper (sync client, batched with row-level fallback)
# ---------------------------------------------------------------------------

def upsert_many(table: str, records: list[dict], client, batch_size: int = 200,
                on_conflict: str | None = None, error_file: Path | None = None) -> tuple[int, int]:
    ok, errs = 0, 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            if on_conflict:
                client.table(table).upsert(batch, on_conflict=on_conflict).execute()
            else:
                client.table(table).upsert(batch).execute()
            ok += len(batch)
        except Exception as e:
            logger.warning("batch upsert %s failed (%s); falling back row-by-row", table, str(e)[:200])
            for rec in batch:
                try:
                    if on_conflict:
                        client.table(table).upsert([rec], on_conflict=on_conflict).execute()
                    else:
                        client.table(table).upsert([rec]).execute()
                    ok += 1
                except Exception as row_e:
                    errs += 1
                    logger.error("row upsert %s id=%s failed: %s", table, rec.get("id", rec.get("order_id", "?")), str(row_e)[:200])
                    if error_file:
                        try:
                            from utils.checkpoint import append_error
                            append_error(error_file, table, rec.get("id", rec.get("order_id")), row_e)
                        except Exception:
                            pass
    return ok, errs


# ---------------------------------------------------------------------------
# Snapshot / rollback
# ---------------------------------------------------------------------------

def write_snapshot(client, run_key: str, snapshot_dir: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = snapshot_dir / f"{SNAPSHOT_PREFIX}{ts}.json"
    data: dict[str, Any] = {"run_key": run_key, "tables": {}, "auth_user_emails": []}
    for t in SNAPSHOT_TABLES:
        rows = client.table(t).select("*").limit(10000).execute().data
        data["tables"][t] = rows
    try:
        res = client.auth.admin.list_users(1, 5000)
        users = res.get("users") if isinstance(res, dict) else res
        data["auth_user_emails"] = [_user_email(u) for u in (users or []) if _user_email(u)]
    except Exception as e:
        data["auth_user_emails"] = []
        data["auth_user_emails_error"] = str(e)[:200]
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info("Snapshot written to %s", path)
    return path


def rollback(client, snapshot_path: Path) -> None:
    snap = json.load(open(snapshot_path))
    email_set = set(snap.get("auth_user_emails") or [])
    for t in ["fulfillments", "transactions", "line_items", "order_discount_codes",
              "discount_codes", "orders", "customer_addresses", "customers"]:
        ids = [r.get("id") for r in (snap.get("tables") or {}).get(t, []) if r.get("id") is not None]
        if not ids:
            print(f"  {t}: no pre-existing rows in snapshot, nothing to delete")
            continue
        print(f"  {t}: deleting {len(ids)} pre-existing row(s)...")
        deleted = 0
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            res = client.table(t).delete().in_("id", chunk).execute()
            deleted += len(res.data or [])
        print(f"    deleted {deleted}")
    if email_set:
        print(f"  auth users: {len(email_set)} pre-existing email(s) NOT deleted automatically; "
              f"remove manually from the Supabase dashboard (auth -> users) if needed.")


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def step_customers(client, orders: list[dict], execute: bool) -> dict:
    customers = load_customers()
    email_to_customer: dict[str, int] = {}
    for c in customers:
        if c["email"]:
            email_to_customer[c["email"].lower()] = c["id"]

    rows, addr_rows = [], []
    unmatched_emails = sorted({(o["email"] or "").lower() for o in orders if o["email"]} - set(email_to_customer))
    stubs = []
    for i, em in enumerate(unmatched_emails):
        cid = CUSTOMER_STUB_BASE + i * 10
        email_to_customer[em] = cid
        first = re.sub(r"[.\-_]", " ", em.split("@")[0]).strip() or "guest"
        stubs.append({
            "id": cid, "email": em, "first_name": first, "last_name": None,
            "phone": None, "state": "enabled", "note": None, "tags": "imported-stub",
            "verified_email": False, "tax_exempt": False,
            "orders_count": 0, "total_spent": 0.0,
            "last_order_id": None, "last_order_name": None, "currency": "INR",
            "accepts_marketing": False, "created_at": None, "updated_at": None,
        })
        rows.append(stubs[-1])

    for c in customers:
        rows.append({
            "id": c["id"], "email": c["email"], "first_name": c["first_name"],
            "last_name": c["last_name"], "phone": c["phone"],
            "state": "enabled", "note": c["note"], "tags": c["tags"],
            "verified_email": False, "tax_exempt": c["tax_exempt"],
            "orders_count": c["orders_count"], "total_spent": c["total_spent"],
            "currency": "INR", "accepts_marketing": c["accepts_marketing"],
            "created_at": None, "updated_at": None,
        })
        a = c["address"]
        if any(v for v in a.values() if v):
            addr_rows.append({
                "id": CUST_ADDR_ID_BASE + c["id"],
                "customer_id": c["id"],
                "first_name": c["first_name"], "last_name": c["last_name"],
                "company": a.get("company"), "address1": a.get("address1"),
                "address2": a.get("address2"), "city": a.get("city"),
                "province": None, "province_code": a.get("province_code"),
                "country": None, "country_code": a.get("country_code"),
                "zip": a.get("zip"), "phone": a.get("phone"),
                "is_default": True, "created_at": None, "updated_at": None,
            })

    report = {
        "customers_in_csv": len(customers),
        "stubs_for_unmatched_order_emails": len(stubs),
        "addresses": len(addr_rows),
    }
    if execute:
        ok1, e1 = upsert_many("customers", rows, client)
        ok2, e2 = upsert_many("customer_addresses", addr_rows, client, on_conflict="id")
        report.update({"upserted_customers": ok1, "customer_errors": e1,
                       "upserted_addresses": ok2, "address_errors": e2})
    else:
        report.update({"upserted_customers": f"dry-run ({len(rows)} would be upserted)",
                       "upserted_addresses": f"dry-run ({len(addr_rows)} would be upserted)"})
    return report


def _user_email(u) -> str | None:
    """Auth user rows come back as pydantic User objects (newer supabase-py)
    or plain dicts; normalize both."""
    if isinstance(u, dict):
        return u.get("email")
    return getattr(u, "email", None)


def step_auth(client, orders: list[dict], execute: bool) -> dict:
    """Create confirmed Supabase auth users for customer + order emails.

    No password is set; first login uses the existing /auth/forgot-password
    reset flow. Existing users are skipped.
    """
    emails: list[str] = []
    seen: set[str] = set()
    for c in load_customers():
        if c["email"] and c["email"].lower() not in seen:
            seen.add(c["email"].lower())
            emails.append(c["email"])
    for o in orders:
        if o["email"] and o["email"].lower() not in seen:
            seen.add(o["email"].lower())
            emails.append(o["email"])

    if not execute:
        return {"auth_users_would_create": len(emails), "auth_users": f"dry-run ({len(emails)} would be created)"}

    existing = set()
    page = 1
    total = 0
    while True:
        res = client.auth.admin.list_users(page, 500)
        users = res.get("users") if isinstance(res, dict) else res
        if not users:
            break
        for u in users:
            em = _user_email(u)
            if em:
                existing.add(em.lower())
        total += len(users)
        if len(users) < 500 or total >= 5000:
            break
        page += 1

    to_create = [e for e in emails if e.lower() not in existing]
    created = skipped = failed = 0
    errors = []
    for em in to_create:
        try:
            client.auth.admin.create_user({
                "email": em,
                "email_confirm": True,
                "user_metadata": {"imported": "shopify"},
            })
            created += 1
        except Exception as e:
            msg = str(e)
            if "already" in msg.lower() or "23505" in msg or "409" in msg:
                skipped += 1
            else:
                failed += 1
                errors.append({"email": em, "error": msg[:200]})
    report = {"auth_to_create": len(to_create), "auth_created": created,
              "auth_skipped": skipped, "auth_failed": failed, "auth_errors": errors[:10]}
    logger.info("Auth users: %s", json.dumps(report))
    return report


def load_email_to_customer(client) -> dict[str, int]:
    cust_rows = client.table("customers").select("id,email").limit(10000).execute().data
    return {c["email"].lower(): c["id"] for c in cust_rows if c.get("email")}


def load_product_title_map(client) -> dict[str, int]:
    prods = client.table("products").select("id,title").limit(10000).execute().data
    m: dict[str, int] = {}
    for p in prods:
        t = (p.get("title") or "").strip().lower()
        if t:
            m[t] = p["id"]
    return m


def _addr_value(v: str | None) -> str | None:
    """Shopify CSVs quote numeric-looking fields with a leading apostrophe
    ('500015) and can exceed column width; trim both or PostgREST 400s."""
    s = clean(v)
    if s is None:
        return None
    if s.startswith("'"):
        s = s[1:]
    return s[:250] if len(s) > 250 else s


def step_orders(client, orders: list[dict], execute: bool, error_file: Path | None = None) -> dict:
    email_map = load_email_to_customer(client)
    if not email_map:
        # Dry run before the customers step has written: build the map from
        # the CSV so the report reflects what a real run would link.
        email_map = {c["email"].lower(): c["id"] for c in load_customers() if c["email"]}
        # stubs for order emails with no customer record (same ids the
        # customers step assigns: stub counter in sorted-unmatched order)
        seen = set(email_map)
        unmatched = sorted({(o["email"] or "").lower() for o in orders if o["email"]} - seen)
        for i, em in enumerate(unmatched):
            email_map[em] = CUSTOMER_STUB_BASE + i * 10
    prod_map = load_product_title_map(client)

    order_rows, line_rows, billing_rows, shipping_rows, disc_rows = [], [], [], [], []
    for o in orders:
        oid = o["shopify_id"]
        cust = email_map.get((o["email"] or "").lower()) if o["email"] else None
        fin = o["financial_status"]
        # legacy shell orders carry an empty Financial Status; keep 'open' so
        # they are visible but not mistaken for settled payments
        order_rows.append({
            "id": oid,
            "name": o["_id"] if o["_id"].startswith("#") else f"#{o['_id']}",
            "customer_id": cust,
            "order_number": o["order_number"],
            "email": o["email"],
            "phone": o["phone"],
            "note": o["notes"],
            "tags": None,
            "financial_status": fin if fin else "open",
            "fulfillment_status": o["fulfillment_status"] or "unfulfilled",
            "currency": o["currency"] or "INR",
            "total_price": o["total"] or 0.0,
            "subtotal_price": o["subtotal"],
            "total_line_items_price": o["subtotal"],
            "total_discounts": o["discount_amount"] or 0.0,
            "total_tax": o["taxes"],
            "total_shipping_price": o["shipping"],
            "buyer_accepts_marketing": False,
            "source_name": "shopify",
            "created_at": parse_ts(o["created_at"]),
            "processed_at": parse_ts(o["paid_at"]),
            "updated_at": parse_ts(o["paid_at"]) or parse_ts(o["created_at"]),
        })
        if any(o["billing"].values()):
            b = {k: _addr_value(v) for k, v in o["billing"].items()}
            name = b.get("first_name") or ""
            billing_rows.append({
                "order_id": oid,
                "first_name": name.split(" ", 1)[0] or None,
                "last_name": name.split(" ", 1)[1] if " " in name else None,
                "address1": b.get("address1"),
                "address2": b.get("address2"),
                "city": b.get("city"),
                "zip": b.get("zip"),
                "province": b.get("province"),
                "country": b.get("country"),
                "phone": b.get("phone"),
                "company": b.get("company"),
            })
        if any(o["shipping_addr"].values()):
            s = {k: _addr_value(v) for k, v in o["shipping_addr"].items()}
            name = s.get("first_name") or ""
            shipping_rows.append({
                "order_id": oid,
                "first_name": name.split(" ", 1)[0] or None,
                "last_name": name.split(" ", 1)[1] if " " in name else None,
                "address1": s.get("address1"),
                "address2": s.get("address2"),
                "city": s.get("city"),
                "zip": s.get("zip"),
                "province": s.get("province"),
                "country": s.get("country"),
                "phone": s.get("phone"),
                "company": s.get("company"),
            })
        if o["discount_code"] and (o["discount_amount"] or 0) > 0:
            # order_discount_codes.id is SERIAL (DB-assigned): no explicit id
            disc_rows.append({
                "order_id": oid,
                "code": o["discount_code"],
                "amount": o["discount_amount"],
            })
        for li in o["line_items"]:
            pid = prod_map.get(li["title"].lower())
            line_rows.append({
                "id": li.get("id"),
                "order_id": oid,
                "product_id": pid,
                "variant_id": None,
                "title": li["title"],
                "sku": li["sku"],
                "price": li["price"],
                "quantity": li["quantity"],
                "requires_shipping": li["requires_shipping"],
                "taxable": li["taxable"],
                "fulfillment_status": li["fulfillment_status"] or "unfulfilled",
            })

    # discount_codes rows so order_discount_codes FK is satisfied.
    # discount_codes requires a price_rules parent; synthetic parent rows use
    # a dedicated base range so admin-created price rules never collide.
    PRICE_RULE_BASE = 6_500_000_000_000_000
    code_rows, code_amounts = [], {}
    for d in disc_rows:
        code_amounts.setdefault(d["code"], d["amount"])
    pr_ids = {}
    for i, (code, amount) in enumerate(sorted(code_amounts.items())):
        pr_id = PRICE_RULE_BASE + i + 1
        pr_ids[code] = pr_id
        code_rows.append({
            "id": DISCOUNT_CODE_ID_BASE + int(hashlib.md5(code.encode()).hexdigest()[:8], 16),
            "price_rule_id": pr_id,
            "code": code,
        })
    price_rule_rows = []
    for i, (code, amount) in enumerate(sorted(code_amounts.items())):
        price_rule_rows.append({
            "id": PRICE_RULE_BASE + i + 1,
            "title": f"Imported: {code}",
            "value": -amount,
            "value_type": "fixed_amount",
            "customer_selection": "all",
            "target_type": "line_item",
            "target_selection": "all",
            "allocation_method": "across",
            "starts_at": "2024-09-01T00:00:00+00:00",
        })

    report = {
        "orders": len(order_rows),
        "line_items": len(line_rows),
        "line_items_matched_product": sum(1 for l in line_rows if l["product_id"]),
        "billing_addresses": len(billing_rows),
        "shipping_addresses": len(shipping_rows),
        "discount_codes": len(code_rows),
        "orders_with_customer_link": sum(1 for r in order_rows if r["customer_id"]),
        "legacy_synth_order_ids": sum(1 for r in order_rows if r["id"] >= ORDER_STUB_BASE),
    }
    if execute:
        if price_rule_rows:
            ok, e = upsert_many("price_rules", price_rule_rows, client, on_conflict="id")
            report.update({"upserted_price_rules": ok, "price_rule_errors": e})
        if code_rows:
            ok, e = upsert_many("discount_codes", code_rows, client, on_conflict="id")
            report.update({"upserted_discount_codes": ok, "discount_code_errors": e})
        ok, e = upsert_many("orders", order_rows, client, on_conflict="id")
        report.update({"upserted_orders": ok, "order_errors": e})
        if billing_rows:
            ok, e = upsert_many("order_billing_addresses", billing_rows, client, on_conflict="order_id")
            report.update({"upserted_billing": ok, "billing_errors": e})
        if shipping_rows:
            ok, e = upsert_many("order_shipping_addresses", shipping_rows, client, on_conflict="order_id")
            report.update({"upserted_shipping": ok, "shipping_errors": e})
        if disc_rows:
            # id-less upsert would re-insert on every run; only insert rows
            # whose (order_id, code) is not already present
            existing_pairs = set()
            for od in client.table("order_discount_codes").select("order_id,code").limit(10000).execute().data:
                existing_pairs.add((od["order_id"], od["code"]))
            new_rows = [d for d in disc_rows if (d["order_id"], d["code"]) not in existing_pairs]
            ok, e = (0, 0)
            if new_rows:
                ok, e = upsert_many("order_discount_codes", new_rows, client, error_file=error_file)
            skipped = len(disc_rows) - len(new_rows)
            report.update({"upserted_order_discounts": ok, "order_discount_errors": e,
                           "order_discounts_skipped_existing": skipped})
        ok, e = upsert_many("line_items", line_rows, client, on_conflict="id")
        report.update({"upserted_line_items": ok, "line_item_errors": e})
    else:
        report["upserted_orders"] = f"dry-run ({len(order_rows)} would be upserted)"
    return report


def step_transactions(client, orders: list[dict], execute: bool) -> dict:
    rows = []
    for o in orders:
        if not o["payment_id"]:
            continue
        refunded = (o["refunded_amount"] or 0)
        amount = (o["total"] or 0.0)
        rows.append({
            "id": TRANSACTION_ID_BASE + (o["shopify_id"] % 1_000_000_000_000),
            "order_id": o["shopify_id"],
            "kind": "sale",
            "status": "success",
            "amount": amount,
            "currency": o["currency"] or "INR",
            "gateway": o["payment_method"] or "unknown",
            "payment_id": o["payment_id"],
            "created_at": parse_ts(o["paid_at"]) or parse_ts(o["created_at"]),
            "processed_at": parse_ts(o["paid_at"]),
        })
    report = {"transactions": len(rows)}
    if execute:
        ok, e = upsert_many("transactions", rows, client, on_conflict="id")
        report.update({"upserted_transactions": ok, "transaction_errors": e})
    else:
        report["upserted_transactions"] = f"dry-run ({len(rows)} would be upserted)"
    return report


def step_fulfillments(client, orders: list[dict], courier: list[dict], execute: bool) -> dict:
    if not courier:
        return {"courier_rows": 0, "note": "Downloaded_Orders.csv not found"}

    def norm(s: str | None) -> str:
        return re.sub(r"\s+", " ", (s or "").strip().lower())

    by_name: dict[str, list[dict]] = {}
    for o in orders:
        nm = norm((o["shipping_addr"] or o["billing"] or {}).get("first_name"))
        if nm:
            by_name.setdefault(nm, []).append(o)

    def _order_dt(o: dict) -> datetime | None:
        iso = o["created_at"]
        if not iso:
            return None
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", iso)
        if not m:
            return None
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
        except ValueError:
            return None

    def courier_iso(row: dict) -> datetime | None:
        d = norm(row["date"])
        m = re.match(r"(\d{2})/(\d{2})/(\d{4})", d)
        if not m:
            return None
        try:
            return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), tzinfo=timezone.utc)
        except ValueError:
            return None

    matched: list[tuple[dict, int, str]] = []
    unmatched: list[dict] = []
    for cr in courier:
        target = None
        c_iso = courier_iso(cr)
        c_name = norm(cr["customer_name"])
        c_zip = (cr["pincode"] or "").strip()
        c_val = cr["value"] or 0.0

        # 1) name + pincode
        if target is None and c_name and c_zip:
            for o in by_name.get(c_name, []):
                so = o["shipping_addr"] or o["billing"]
                if str(so.get("zip", "")).strip() == c_zip:
                    target = o
                    break
        # 2) name + date within 3 days + value match
        if target is None and c_name and c_iso:
            for o in by_name.get(c_name, []):
                o_dt = _order_dt(o)
                if o_dt is None:
                    continue
                if abs((o_dt - c_iso).days) <= 3 and o["total"] is not None and abs(o["total"] - c_val) < 0.01:
                    target = o
                    break
        # 3) name + date within 3 days (any value)
        if target is None and c_name and c_iso:
            for o in by_name.get(c_name, []):
                o_dt = _order_dt(o)
                if o_dt is not None and abs((o_dt - c_iso).days) <= 3:
                    target = o
                    break

        if target is not None:
            zips = [str((target["shipping_addr"] or target["billing"]).get("zip", "")).strip()]
            if c_zip and c_zip in zips:
                method = "name+pincode"
            elif c_val and target["total"] is not None and abs(target["total"] - c_val) < 0.01:
                method = "name+date+value"
            else:
                method = "name+date"
            matched.append((cr, target["shopify_id"], method))
        else:
            unmatched.append(cr)

    status_map = {"Delivered": "shipped", "Cancelled": "cancelled", "Undelivered": "out_for_delivery"}
    frows = []
    for i, (cr, oid, method) in enumerate(matched):
        frows.append({
            "id": FULFILLMENT_ID_BASE + i + 1,
            "order_id": oid,
            "status": status_map.get((cr["status"] or "").strip(), "shipped"),
            "service": None,
            "name": None,
            "tracking_company": cr["courier"],
            "tracking_number": cr["awb_no"],
            "tracking_numbers": [cr["awb_no"]] if cr["awb_no"] else None,
            "created_at": _dd_mmyyyy_to_utc(cr["date"]),
            "updated_at": _dd_mmyyyy_to_utc(cr["awb_date"] or cr["date"]),
        })

    review_path = Path.cwd() / "import_orders_customers_unmatched_courier.csv"
    report = {"courier_rows": len(courier), "fulfillments_created": len(frows),
              "courier_matched": len(matched), "courier_unmatched": len(unmatched)}
    if execute:
        ok, e = upsert_many("fulfillments", frows, client, on_conflict="id")
        report.update({"upserted_fulfillments": ok, "fulfillment_errors": e})
        if unmatched:
            cols = ["date", "order_id", "customer_name", "customer_email", "customer_mobile",
                    "pincode", "courier", "awb_no", "status", "value", "channel", "payment_method"]
            with open(review_path, "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
                w.writeheader()
                for r in unmatched:
                    w.writerow(r)
            report["unmatched_review_file"] = str(review_path)
    return report


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def _dd_mmyyyy_to_utc(value: str | None) -> str | None:
    """'dd/mm/yyyy hh:mm:ss' (IST) -> UTC ISO, or None."""
    if not value:
        return None
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?", (value or "").strip())
    if not m:
        return None
    try:
        dt = datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)),
                      int(m.group(4) or 0), int(m.group(5) or 0), int(m.group(6) or 0),
                      tzinfo=timezone.utc)  # treat as UTC-ish; only used for created_at ordering
        return dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return None


def main() -> int:
    parser = create_parser("Import Shopify customers/orders/fulfillments from data/shopify/*.csv")
    parser.add_argument("--steps", type=str, default=",".join(ALL_STEPS),
                        help=f"Comma-separated steps: {','.join(ALL_STEPS)} (default: all)")
    parser.add_argument("--snapshot-dir", type=str, default=".",
                        help="Directory for the pre-run rollback snapshot (default: cwd)")
    parser.add_argument("--rollback", type=str, default=None, metavar="SNAPSHOT_JSON",
                        help="Rollback using a previously written snapshot file, then exit")
    parser.add_argument("--fresh", action="store_true",
                        help="Ignore the checkpoint and re-run all requested steps")
    args = parser.parse_args()
    configure_logging(args.verbose)

    if args.rollback:
        snap_path = Path(args.rollback)
        if not snap_path.exists():
            print(f"Snapshot file not found: {snap_path}")
            return 2
        client = get_supabase_client()
        rollback(client, snap_path)
        print("Rollback complete.")
        return 0

    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")

    steps = [s.strip() for s in args.steps.split(",") if s.strip()]
    bad = [s for s in steps if s not in ALL_STEPS]
    if bad:
        print(f"Unknown steps: {bad}. Valid: {ALL_STEPS}")
        return 2

    client = get_supabase_client()

    ckpt = load_checkpoint(CHECKPOINT_FILE)
    done = set(ckpt.get("completed_entities", []))
    if args.fresh:
        done = set()
        ckpt = {"completed_entities": []}
    to_run = [s for s in steps if s not in done]
    if not to_run:
        print("All requested steps already complete per checkpoint "
              f"({CHECKPOINT_FILE}). Use --fresh to ignore the checkpoint.")
        return 0

    orders = load_orders()
    courier = load_courier()

    print("\n=== PRE-IMPORT COUNTS (live DB) ===")
    for t in ["customers", "customer_addresses", "orders", "line_items",
              "transactions", "fulfillments", "discount_codes", "order_discount_codes"]:
        print(f"  {t}: {get_supabase_count(client, t)}")
    print(f"\n=== CSV INPUTS ===")
    print(f"  customers: {len(load_customers())}")
    print(f"  orders: {len(orders)}")
    print(f"  courier rows: {len(courier)}")

    # Snapshot before the first write of this run
    if execute:
        snap_dir = Path(args.snapshot_dir).resolve()
        snap_dir.mkdir(parents=True, exist_ok=True)
        write_snapshot(client, "|".join(to_run), snap_dir)

    report: dict[str, Any] = {}
    error_file = Path.cwd() / "import_orders_customers_errors.json"
    try:
        for name in to_run:
            print(f"\n=== STEP: {name} {'(EXECUTE)' if execute else '(dry-run)'} ===")
            if name == STEP_CUSTOMERS:
                r = step_customers(client, orders, execute)
            elif name == STEP_AUTH:
                r = step_auth(client, orders, execute)
            elif name == STEP_ORDERS:
                r = step_orders(client, orders, execute, error_file)
            elif name == STEP_TRANSACTIONS:
                r = step_transactions(client, orders, execute)
            elif name == STEP_FULFILLMENTS:
                r = step_fulfillments(client, orders, courier, execute)
            else:
                continue
            report[name] = r
            if execute:
                mark_entity_done(CHECKPOINT_FILE, name)
                print(f"  step {name} complete + checkpointed")
    except Exception:
        logger.exception("Import failed")
        if execute:
            print("\nImport failed mid-run. The snapshot written above covers the pre-run state; "
                  "re-run with --rollback <snapshot>.json to undo any completed steps.")
        raise SystemExit(1)

    print("\n=== SUMMARY ===")
    print(json.dumps(report, indent=2, default=str))

    if execute:
        print("\nDone. Verify: python verify_migration.py --quick")
    return 0


if __name__ == "__main__":
    sys.exit(main())
