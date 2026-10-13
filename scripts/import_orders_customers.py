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

Use --rollback with a new run-stamped snapshot to restore overwritten rows and
remove only writes journaled by that run. Older snapshots without a write
journal are refused rather than risking deletion of pre-existing data.

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
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from utils.checkpoint import clear_checkpoint, load_checkpoint, mark_entity_done
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
SNAPSHOT_TABLES += ["price_rules", "order_billing_addresses", "order_shipping_addresses"]
SNAPSHOT_PAGE_SIZE = 1000
SNAPSHOT_MAX_ROWS = 100_000
ACTIVE_SNAPSHOT_PATH: Path | None = None

# Tables touched by this importer and the identity used to restore/delete only
# rows written by this run. order_discount_codes has no natural single-column
# key; this importer only inserts absent (order_id, code) pairs.
WRITE_KEYS = {
    "customers": ("id",),
    "customer_addresses": ("id",),
    "orders": ("id",),
    "line_items": ("id",),
    "transactions": ("id",),
    "fulfillments": ("id",),
    "discount_codes": ("id",),
    "price_rules": ("id",),
    "order_billing_addresses": ("order_id",),
    "order_shipping_addresses": ("order_id",),
    "order_discount_codes": ("order_id", "code"),
}

# Synthetic ids are offset far from any Shopify-generated id (<=13 digits) so
# a real id can never collide with these.
CUSTOMER_STUB_BASE = 9_000_000_000_000_000      # order emails with no customer record
LINE_ITEM_ID_BASE = 4_000_000_000_000_000       # legacy orders have no numeric Shopify id
CUST_ADDR_ID_BASE = 8_000_000_000_000_000       # customer default addresses (id = base + customer_id)
ORDER_STUB_BASE = 3_000_000_000_000_000         # legacy orders with only a Name like #YORD...
FULFILLMENT_ID_BASE = 5_000_000_000_000_000
TRANSACTION_ID_BASE = 7_000_000_000_000_000
DISCOUNT_CODE_ID_BASE = 6_000_000_000_000_000
PRICE_RULE_BASE = 6_500_000_000_000_000


def stable_synthetic_id(base: int, source_identity: str) -> int:
    """Derive a repeatable synthetic BIGINT from a source record identity."""
    return base + int(hashlib.sha256(source_identity.encode()).hexdigest()[:12], 16)


def price_rule_id(code: str) -> int:
    return stable_synthetic_id(PRICE_RULE_BASE, code)


def fulfillment_id(source_row: dict) -> int:
    identity = json.dumps(source_row, sort_keys=True, separators=(",", ":"), default=str)
    return stable_synthetic_id(FULFILLMENT_ID_BASE, identity)


def step_row_error_count(report: dict) -> int:
    """Count reported row failures so a partial step cannot be checkpointed."""
    total = sum(
        value for key, value in report.items()
        if key.endswith("_errors") and isinstance(value, int)
    )
    auth_failed = report.get("auth_failed", 0)
    return total + (auth_failed if isinstance(auth_failed, int) else 0)


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
    """Group all export rows by Shopify Name, including blank-Id continuations."""
    rows = read_csv(ORDERS_CSV)
    rows_by_name: dict[str, list[dict]] = {}
    last_name: str | None = None
    for r in rows:
        name = clean(r.get("Name"))
        if name:
            last_name = name
        # Shopify continuation rows can omit Name as well as Id. They belong
        # to the immediately preceding named order in the export.
        name = name or last_name
        if not name:
            continue
        rows_by_name.setdefault(name, []).append(r)

    orders = []
    for name, order_rows in rows_by_name.items():
        order = {
            "_id": name,
            "_source_name": name,
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
        }
        id_rows = [r for r in order_rows if clean(r.get("Id"))]
        source_id = clean(id_rows[0].get("Id")).lstrip("'") if id_rows else None
        # Name, not Id, is the source for the customer-visible order name and
        # order number. Shopify names include both "#1234" and "#YORD1234".
        number = re.search(r"(\d+)\s*$", name)
        if number:
            order["order_number"] = int(number.group(1))

        # Rows with an actual Shopify Id carry the authoritative order-level
        # fields. Continuations are fallback only when that row omits a value.
        metadata_rows = id_rows + [r for r in order_rows if not clean(r.get("Id"))]
        if source_id and not source_id.isdigit():
            raise ValueError(f"Order {name} has a non-numeric Shopify Id: {source_id!r}")
        for r in metadata_rows:
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
                if order[dst] is None:
                    order[dst] = clean(r.get(src))
            for src, dst in [
                ("Subtotal", "subtotal"), ("Shipping", "shipping"),
                ("Taxes", "taxes"), ("Total", "total"),
                ("Discount Amount", "discount_amount"),
            ]:
                if order[dst] is None:
                    order[dst] = parse_money(r.get(src))
            for field in [
                "Name", "Street", "Address1", "Address2", "Company",
                "City", "Zip", "Province", "Country", "Phone",
            ]:
                billing = clean(r.get(f"Billing {field}"))
                shipping = clean(r.get(f"Shipping {field}"))
                if field == "Name":
                    if order["billing"].get("first_name") is None and billing:
                        order["billing"]["first_name"] = billing
                    if order["shipping_addr"].get("first_name") is None and shipping:
                        order["shipping_addr"]["first_name"] = shipping
                else:
                    if billing and order["billing"].get(field.lower()) is None:
                        order["billing"][field.lower()] = billing
                    if shipping and order["shipping_addr"].get(field.lower()) is None:
                        order["shipping_addr"][field.lower()] = shipping

        # Keep line items in source/export order, irrespective of which row was
        # selected first for the order-level values.
        for r in order_rows:
            title = clean(r.get("Lineitem name"))
            if title:
                order["line_items"].append({
                    "title": title,
                    "quantity": int(parse_money(r.get("Lineitem quantity"), 1) or 1),
                    "price": parse_money(r.get("Lineitem price")),
                    "sku": clean(r.get("Lineitem sku")),
                    "requires_shipping": parse_bool(r.get("Lineitem requires shipping")),
                    "taxable": parse_bool(r.get("Lineitem taxable")),
                    "fulfillment_status": clean(r.get("Lineitem fulfillment status")),
                })

        oid = int(source_id) if source_id and source_id.isdigit() else None
        order["shopify_id"] = oid
        # Allocate a deterministic synthetic id only when no usable source Id
        # exists across any row belonging to this order.
        if oid is None:
            order["shopify_id"] = stable_synthetic_id(ORDER_STUB_BASE, name)
        # line-item ids need the numeric order id
        for idx, li in enumerate(order["line_items"]):
            base = oid if oid is not None else order["shopify_id"]
            li["id"] = LINE_ITEM_ID_BASE + base * 1000 + idx
            li["li_index"] = idx
        orders.append(order)
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
            record_write_intent(table, batch)
            if on_conflict:
                client.table(table).upsert(batch, on_conflict=on_conflict).execute()
            else:
                client.table(table).upsert(batch).execute()
            ok += len(batch)
        except Exception as e:
            logger.warning("batch upsert %s failed (%s); falling back row-by-row", table, str(e)[:200])
            for rec in batch:
                try:
                    record_write_intent(table, [rec])
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
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    path = snapshot_dir / f"{SNAPSHOT_PREFIX}{ts}-{uuid.uuid4().hex}.json"
    data: dict[str, Any] = {
        "run_key": run_key,
        "tables": {},
        "complete_tables": [],
        "run_writes": {},
        "auth_user_emails": [],
        "auth_user_emails_complete": False,
        "auth_created_user_ids": [],
        "auth_create_pending_emails": [],
    }
    for t in SNAPSHOT_TABLES:
        rows = []
        offset = 0
        while True:
            query = client.table(t).select("*")
            # Order by the rollback identity so page membership is
            # deterministic instead of depending on PostgREST's default order.
            for key_field in WRITE_KEYS[t]:
                query = query.order(key_field)
            batch = query.range(
                offset, offset + SNAPSHOT_PAGE_SIZE - 1
            ).execute().data or []
            rows.extend(batch)
            if len(batch) < SNAPSHOT_PAGE_SIZE:
                break
            offset += SNAPSHOT_PAGE_SIZE
            if len(rows) > SNAPSHOT_MAX_ROWS:
                raise RuntimeError(
                    f"Cannot create a complete rollback snapshot for {t}: "
                    f"more than {SNAPSHOT_MAX_ROWS} rows"
                )
        data["tables"][t] = rows
        data["complete_tables"].append(t)
    try:
        users = []
        page = 1
        while len(users) < 5000:
            res = client.auth.admin.list_users(page, min(500, 5000 - len(users)))
            batch = res.get("users") if isinstance(res, dict) else res
            batch = batch or []
            users.extend(batch)
            if len(batch) < 500:
                data["auth_user_emails_complete"] = True
                break
            page += 1
        data["auth_user_emails"] = [
            _user_email(user) for user in users if _user_email(user)
        ]
    except Exception as e:
        data["auth_user_emails"] = []
        data["auth_user_emails_error"] = str(e)[:200]
    # Exclusive creation guarantees a snapshot is never silently overwritten,
    # even if the run-id generator or clock is unexpectedly duplicated.
    with open(path, "x", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info("Snapshot written to %s", path)
    return path


def _write_identity(table: str, row: dict) -> dict:
    fields = WRITE_KEYS.get(table)
    if not fields or any(row.get(field) is None for field in fields):
        raise RuntimeError(
            f"Rollback tracking cannot identify a write to {table}: "
            f"expected key fields {fields}"
        )
    return {field: row[field] for field in fields}


def _same_identity(row: dict, identity: dict) -> bool:
    return all(str(row.get(field)) == str(value) for field, value in identity.items())


def record_write_intent(table: str, records: list[dict]) -> None:
    """Journal keys before an upsert so rollback is scoped to this import."""
    if ACTIVE_SNAPSHOT_PATH is None or not records:
        return
    if table not in SNAPSHOT_TABLES:
        raise RuntimeError(f"Rollback snapshot does not cover writes to {table}")
    with open(ACTIVE_SNAPSHOT_PATH, encoding="utf-8") as f:
        snapshot = json.load(f)
    if table not in snapshot.get("complete_tables", []):
        raise RuntimeError(f"Rollback snapshot for {table} is not complete")
    entries = snapshot.setdefault("run_writes", {}).setdefault(table, [])
    recorded = {json.dumps(entry["key"], sort_keys=True) for entry in entries}
    prior_rows = snapshot.get("tables", {}).get(table, [])
    for row in records:
        identity = _write_identity(table, row)
        key = json.dumps(identity, sort_keys=True)
        if key in recorded:
            continue
        prior = next((old for old in prior_rows if _same_identity(old, identity)), None)
        if table == "order_discount_codes" and prior is not None:
            raise RuntimeError(
                "Refusing to import an existing order_discount_codes pair: "
                "the table has no unique (order_id, code) conflict key for safe rollback"
            )
        entries.append({"key": identity, "before": prior})
        recorded.add(key)
    with open(ACTIVE_SNAPSHOT_PATH, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, default=str)


def record_auth_create_intent(email: str) -> None:
    if ACTIVE_SNAPSHOT_PATH is None:
        raise RuntimeError("Auth creation has no active rollback snapshot")
    with open(ACTIVE_SNAPSHOT_PATH, encoding="utf-8") as f:
        snapshot = json.load(f)
    if not snapshot.get("auth_user_emails_complete"):
        raise RuntimeError(
            "Auth creation refused: snapshot could not confirm the complete "
            "pre-run user list"
        )
    known = {value.lower() for value in snapshot.get("auth_user_emails", [])}
    if email.lower() in known:
        raise RuntimeError(f"Auth creation refused for pre-existing user {email}")
    pending = snapshot.setdefault("auth_create_pending_emails", [])
    if email.lower() not in {value.lower() for value in pending}:
        pending.append(email)
    with open(ACTIVE_SNAPSHOT_PATH, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, default=str)


def record_auth_created(email: str, user_id: str | None) -> None:
    if ACTIVE_SNAPSHOT_PATH is None or not user_id:
        raise RuntimeError(
            f"Auth user {email} was created without a journaled user id; "
            "rollback will refuse until resolved manually"
        )
    with open(ACTIVE_SNAPSHOT_PATH, encoding="utf-8") as f:
        snapshot = json.load(f)
    created = snapshot.setdefault("auth_created_user_ids", [])
    if user_id not in created:
        created.append(user_id)
    snapshot["auth_create_pending_emails"] = [
        value for value in snapshot.get("auth_create_pending_emails", [])
        if value.lower() != email.lower()
    ]
    with open(ACTIVE_SNAPSHOT_PATH, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, default=str)


def rollback(client, snapshot_path: Path) -> None:
    with open(snapshot_path, encoding="utf-8") as f:
        snap = json.load(f)
    # Old snapshots are only pre-run dumps. They cannot distinguish rows this
    # import created from pre-existing rows, so refuse before any DB operation.
    if not isinstance(snap.get("run_writes"), dict) or not isinstance(
        snap.get("complete_tables"), list
    ):
        raise RuntimeError(
            "Rollback refused: this snapshot has no complete per-run write journal. "
            "No database rows were changed; use the snapshot to restore manually."
        )
    writes = snap["run_writes"]
    pending_auth = snap.get("auth_create_pending_emails", [])
    if pending_auth:
        raise RuntimeError(
            "Rollback refused: auth creation outcome is uncertain for "
            f"{', '.join(pending_auth)}. No database rows were changed."
        )
    auth_ids = snap.get("auth_created_user_ids", [])
    if not isinstance(auth_ids, list) or any(not isinstance(user_id, str) for user_id in auth_ids):
        raise RuntimeError(
            "Rollback refused: invalid auth-user write journal. No database rows were changed."
        )
    for table, entries in writes.items():
        if table not in WRITE_KEYS or table not in snap["complete_tables"]:
            raise RuntimeError(
                f"Rollback refused: snapshot cannot safely identify writes to {table}. "
                "No database rows were changed."
            )
        if any(not isinstance(entry, dict) or not isinstance(entry.get("key"), dict)
               for entry in entries):
            raise RuntimeError(
                f"Rollback refused: invalid write journal entry for {table}. "
                "No database rows were changed."
            )
        for entry in entries:
            if set(entry["key"]) != set(WRITE_KEYS[table]):
                raise RuntimeError(
                    f"Rollback refused: invalid identity for {table}. "
                    "No database rows were changed."
                )
            before = entry.get("before")
            if before is not None and (
                not isinstance(before, dict) or not _same_identity(before, entry["key"])
            ):
                raise RuntimeError(
                    f"Rollback refused: prior row identity mismatch for {table}. "
                    "No database rows were changed."
                )
            if table == "order_discount_codes" and before is not None:
                raise RuntimeError(
                    "Rollback refused: order_discount_codes has no unique "
                    "(order_id, code) conflict key. No database rows were changed."
                )

    restore_order = [
        "customers", "price_rules", "orders", "customer_addresses",
        "order_billing_addresses", "order_shipping_addresses", "line_items",
        "transactions", "fulfillments", "discount_codes", "order_discount_codes",
    ]
    for table in restore_order:
        for entry in writes.get(table, []):
            before = entry.get("before")
            if before is None:
                continue
            conflict = ",".join(entry["key"])
            client.table(table).upsert([before], on_conflict=conflict).execute()
            print(f"  {table}: restored prior row {entry['key']}")
    for table in reversed(restore_order):
        for entry in writes.get(table, []):
            if entry.get("before") is not None:
                continue
            query = client.table(table).delete()
            for field, value in entry["key"].items():
                query = query.eq(field, value)
            query.execute()
            print(f"  {table}: removed run-created row {entry['key']}")

    for user_id in auth_ids:
        client.auth.admin.delete_user(user_id)
        print(f"  auth users: removed run-created user {user_id}")


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


def _user_id(user) -> str | None:
    if isinstance(user, dict):
        nested = user.get("user", user)
        return nested.get("id") if isinstance(nested, dict) else None
    nested = getattr(user, "user", user)
    return getattr(nested, "id", None)


def clear_auth_create_intent(email: str) -> None:
    if ACTIVE_SNAPSHOT_PATH is None:
        return
    with open(ACTIVE_SNAPSHOT_PATH, encoding="utf-8") as f:
        snapshot = json.load(f)
    snapshot["auth_create_pending_emails"] = [
        value for value in snapshot.get("auth_create_pending_emails", [])
        if value.lower() != email.lower()
    ]
    with open(ACTIVE_SNAPSHOT_PATH, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, default=str)


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
            record_auth_create_intent(em)
            user = client.auth.admin.create_user({
                "email": em,
                "email_confirm": True,
                "user_metadata": {"imported": "shopify"},
            })
            record_auth_created(em, _user_id(user))
            created += 1
        except Exception as e:
            msg = str(e)
            if "already" in msg.lower() or "23505" in msg or "409" in msg:
                clear_auth_create_intent(em)
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
            "name": o["_source_name"] or o["_id"],
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
    code_rows, code_amounts = [], {}
    for d in disc_rows:
        code_amounts.setdefault(d["code"], d["amount"])
    pr_ids = {}
    for code, amount in sorted(code_amounts.items()):
        pr_id = price_rule_id(code)
        pr_ids[code] = pr_id
        code_rows.append({
            "id": DISCOUNT_CODE_ID_BASE + int(hashlib.md5(code.encode()).hexdigest()[:8], 16),
            "price_rule_id": pr_id,
            "code": code,
        })
    price_rule_rows = []
    for code, amount in sorted(code_amounts.items()):
        price_rule_rows.append({
            "id": pr_ids[code],
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
    for cr, oid, method in matched:
        frows.append({
            "id": fulfillment_id(cr),
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
    global ACTIVE_SNAPSHOT_PATH
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
        try:
            rollback(client, snap_path)
        except RuntimeError as e:
            print(str(e))
            return 1
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
        clear_checkpoint(CHECKPOINT_FILE)
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
        try:
            ACTIVE_SNAPSHOT_PATH = write_snapshot(client, "|".join(to_run), snap_dir)
        except Exception as e:
            logger.exception("Could not write a complete rollback snapshot")
            print(f"Cannot safely start import: rollback snapshot failed: {e}")
            return 1

    report: dict[str, Any] = {}
    row_errors = False
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
            step_errors = step_row_error_count(r)
            if step_errors:
                row_errors = True
                print(f"  step {name} had {step_errors} row error(s); not checkpointed")
            elif execute:
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
    return 1 if row_errors else 0


if __name__ == "__main__":
    sys.exit(main())
