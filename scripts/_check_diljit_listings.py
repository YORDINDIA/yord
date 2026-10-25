#!/usr/bin/env python3
"""Verification helper: download the first gallery image of every Diljit listing.

Not part of the publish pipeline -- this is the visual-check step. Writes
`/tmp/yord_audit/check/<handle>.webp` plus a `manifest.json` so the sheet builder
can label tiles with the listing title.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

OUT = Path("/tmp/yord_audit/check")
OUT.mkdir(parents=True, exist_ok=True)

url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
key = os.environ["SUPABASE_SECRET_KEY"]
h = {"apikey": key, "Authorization": f"Bearer {key}"}

prods = requests.get(
    f"{url}/rest/v1/products",
    params={"select": "id,handle,title", "handle": "like.diljit-dosanjh-*", "order": "id"},
    headers=h,
).json()

manifest = []
for p in prods:
    imgs = requests.get(
        f"{url}/rest/v1/product_images",
        params={"select": "position,src", "product_id": f"eq.{p['id']}", "order": "position"},
        headers=h,
    ).json()
    first = imgs[0]["src"] if imgs else None
    entry = {"handle": p["handle"], "title": p["title"], "images": len(imgs), "first": first}
    manifest.append(entry)
    if first:
        dest = OUT / f"{p['handle']}.webp"
        dest.write_bytes(requests.get(first, timeout=40).content)

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
print(f"{len(manifest)} listings, images cached in {OUT}")
for e in manifest:
    print(f"  {e['images']} img  {e['handle']}")
