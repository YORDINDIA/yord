#!/usr/bin/env python3
"""Apply product_patches.json: add size variants + copy fixes via REST."""
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402
import json  # noqa: E402

load_dotenv()
ROOT = Path(__file__).parent.parent
pp = json.load(open(ROOT / "data" / "product_patches.json"))
base, secret = resolve_supabase_url(), resolve_supabase_secret_key()
H = {"apikey": secret, "Content-Type": "application/json",
     "Prefer": "resolution=merge-duplicates,return=minimal"}

# handle -> product id
r = requests.get(f"{base}/rest/v1/products?select=id,handle",
                 headers={"apikey": secret}, timeout=60)
pmap = {row["handle"]: row["id"] for row in r.json()}

# next variant id
r = requests.get(f"{base}/rest/v1/product_variants?select=id&order=id.desc&limit=1",
                 headers={"apikey": secret}, timeout=60)
next_id = (r.json()[0]["id"] if r.json() else 0) + 1

new_vars = []
for add in pp.get("variant_adds", []):
    pid = pmap.get(add["handle"])
    if pid is None:
        print("UNKNOWN product", add["handle"])
        continue
    # existing option1 values to avoid dupes
    er = requests.get(f"{base}/rest/v1/product_variants?product_id=eq.{pid}&select=option1",
                      headers={"apikey": secret}, timeout=30)
    have = {str(x["option1"]).upper() for x in er.json() if x["option1"]}
    pos = len(have) + 1
    for v in add["needs_variants"]:
        if str(v["option1"]).upper() in have:
            continue
        new_vars.append({"id": next_id, "product_id": pid,
                         "title": f"{v['option1']}", "price": v["price"],
                         "position": pos, "option1": v["option1"],
                         "inventory_quantity": 100, "inventory_policy": "deny",
                         "fulfillment_service": "manual",
                         "requires_shipping": True, "taxable": True})
        next_id += 1
        pos += 1

print(f"new variants: {len(new_vars)}")
errs = 0
for i in range(0, len(new_vars), 500):
    rr = requests.post(f"{base}/rest/v1/product_variants", headers=H,
                       json=new_vars[i:i + 500], timeout=60)
    if rr.status_code not in (200, 201, 204):
        errs += 1
        print("VARIANT FAIL:", rr.status_code, rr.text[:200])
print("variant errors:", errs)

fixed = 0
for cf in pp.get("copy_fixes", []):
    h = cf.pop("handle")
    rr = requests.patch(f"{base}/rest/v1/products?handle=eq.{h}", headers=H,
                        json=cf, timeout=30)
    if rr.status_code in (200, 204):
        fixed += 1
    else:
        print("COPY FAIL:", h, rr.status_code, rr.text[:150])
print(f"copy fixes: {fixed}/{len(pp.get('copy_fixes', []))}")
