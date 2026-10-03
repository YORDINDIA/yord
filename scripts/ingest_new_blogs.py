#!/usr/bin/env python3
"""Validate + ingest data/new_blogs/batch_*.json into articles."""
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402
import json  # noqa: E402

load_dotenv()
ROOT = Path(__file__).parent.parent
NB = ROOT / "data" / "new_blogs"

base, secret = resolve_supabase_url(), resolve_supabase_secret_key()
H = {"apikey": secret, "Content-Type": "application/json",
     "Prefer": "resolution=merge-duplicates,return=minimal"}

r = requests.get(f"{base}/rest/v1/articles?select=id,handle",
                 headers={"apikey": secret}, timeout=60)
existing = r.json()
e_handles = {x["handle"] for x in existing}
e_ids = {x["id"] for x in existing}
print(f"existing articles: {len(existing)}")

all_rows = []
for bf in sorted(NB.glob("batch_*.json")):
    rows = json.load(open(bf))
    print(f"{bf.name}: {len(rows)}")
    all_rows.extend(rows)

print(f"total new: {len(all_rows)}")
# validations
assert len({x["id"] for x in all_rows}) == len(all_rows), "dup ids in batches"
assert len({x["handle"] for x in all_rows}) == len(all_rows), "dup handles in batches"
clash_h = [x["handle"] for x in all_rows if x["handle"] in e_handles]
clash_i = [x["id"] for x in all_rows if x["id"] in e_ids]
assert not clash_h, f"handle clash: {clash_h}"
assert not clash_i, f"id clash: {clash_i}"
for x in all_rows:
    assert x["blog_id"] == 89876988081
    assert "<" in x["body_html"] and ">" in x["body_html"]
print("validation OK")

ok = 0
for i in range(0, len(all_rows), 200):
    rr = requests.post(f"{base}/rest/v1/articles", headers=H,
                       json=all_rows[i:i + 200], timeout=90)
    if rr.status_code in (200, 201, 204):
        ok += len(all_rows[i:i + 200])
    else:
        print("FAIL:", rr.status_code, rr.text[:300])
print(f"ingested {ok}/{len(all_rows)}")
