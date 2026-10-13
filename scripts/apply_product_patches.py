#!/usr/bin/env python3
"""Apply product_patches.json: add size variants + copy fixes via REST."""
import json
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402

ROOT = Path(__file__).parent.parent


def confirmed_updated_count(response) -> int:
    """Count rows actually returned by a representation-enabled PATCH."""
    if response.status_code not in (200, 201):
        return 0
    try:
        rows = response.json()
    except (ValueError, AttributeError):
        return 0
    return len(rows) if isinstance(rows, list) else 0


def main() -> int:
    load_dotenv()
    pp = json.loads((ROOT / "data" / "product_patches.json").read_text())
    base, secret = resolve_supabase_url(), resolve_supabase_secret_key()
    headers = {
        "apikey": secret,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    # handle -> product id
    response = requests.get(
        f"{base}/rest/v1/products?select=id,handle",
        headers={"apikey": secret},
        timeout=60,
    )
    response.raise_for_status()
    product_rows = response.json()
    if not isinstance(product_rows, list):
        raise ValueError("products response must be a JSON array")
    pmap = {row["handle"]: row["id"] for row in product_rows}

    # next variant id
    response = requests.get(
        f"{base}/rest/v1/product_variants?select=id&order=id.desc&limit=1",
        headers={"apikey": secret},
        timeout=60,
    )
    response.raise_for_status()
    existing_ids = response.json()
    if not isinstance(existing_ids, list):
        raise ValueError("product_variants response must be a JSON array")
    next_id = (existing_ids[0]["id"] if existing_ids else 0) + 1

    new_vars = []
    for add in pp.get("variant_adds", []):
        pid = pmap.get(add["handle"])
        if pid is None:
            print("UNKNOWN product", add["handle"])
            continue
        existing_response = requests.get(
            f"{base}/rest/v1/product_variants?product_id=eq.{pid}&select=option1",
            headers={"apikey": secret},
            timeout=30,
        )
        existing_response.raise_for_status()
        existing_rows = existing_response.json()
        if not isinstance(existing_rows, list):
            raise ValueError(f"product_variants response for {pid} must be a JSON array")
        have = {str(row["option1"]).upper() for row in existing_rows if row["option1"]}
        pos = len(have) + 1
        for variant in add["needs_variants"]:
            if str(variant["option1"]).upper() in have:
                continue
            new_vars.append({
                "id": next_id,
                "product_id": pid,
                "title": f"{variant['option1']}",
                "price": variant["price"],
                "position": pos,
                "option1": variant["option1"],
                "inventory_quantity": 100,
                "inventory_policy": "deny",
                "fulfillment_service": "manual",
                "requires_shipping": True,
                "taxable": True,
            })
            next_id += 1
            pos += 1

    print(f"new variants: {len(new_vars)}")
    errors = 0
    for i in range(0, len(new_vars), 500):
        response = requests.post(
            f"{base}/rest/v1/product_variants",
            headers=headers,
            json=new_vars[i:i + 500],
            timeout=60,
        )
        if response.status_code not in (200, 201, 204):
            errors += 1
            print("VARIANT FAIL:", response.status_code, response.text[:200])
    print("variant errors:", errors)

    copy_headers = {**headers, "Prefer": "return=representation"}
    copy_fixes = pp.get("copy_fixes", [])
    fixed = 0
    copy_errors = 0
    for fix in copy_fixes:
        handle = fix["handle"]
        payload = {key: value for key, value in fix.items() if key != "handle"}
        response = requests.patch(
            f"{base}/rest/v1/products?handle=eq.{handle}",
            headers=copy_headers,
            json=payload,
            timeout=30,
        )
        confirmed = confirmed_updated_count(response)
        fixed += confirmed
        if not confirmed:
            copy_errors += 1
            print("COPY FAIL:", handle, response.status_code, response.text[:150])
    print(f"copy fixes: {fixed}/{len(copy_fixes)} confirmed updated row(s)")
    return 1 if errors or copy_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
