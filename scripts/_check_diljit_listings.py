#!/usr/bin/env python3
"""Verification helper: download the first gallery image of every Diljit listing.

Not part of the publish pipeline -- this is the visual-check step. Writes
`/tmp/yord_audit/check/<handle>.webp` plus a `manifest.json` so the sheet builder
can label tiles with the listing title.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402

load_dotenv()

OUT = Path("/tmp/yord_audit/check")
OUT.mkdir(parents=True, exist_ok=True)

# `SUPABASE_URL` is the documented script override (utils.config resolves it
# first, falling back to the app's NEXT_PUBLIC_* name); reading the env var
# directly here used to audit whatever project the app pointed at.
url = resolve_supabase_url()
key = resolve_supabase_secret_key()
if not url or not key:
    print("SUPABASE_URL / SUPABASE_SECRET_KEY missing from .env", file=sys.stderr)
    sys.exit(2)
h = {"apikey": key, "Authorization": f"Bearer {key}"}


def get_json(path: str, params: dict):
    response = requests.get(f"{url}/rest/v1/{path}", params=params, headers=h, timeout=30)
    response.raise_for_status()
    return response.json()


prods = get_json("products", {"select": "id,handle,title", "handle": "like.diljit-dosanjh-*", "order": "id"})

manifest = []
for p in prods:
    imgs = get_json("product_images", {"select": "position,src", "product_id": f"eq.{p['id']}", "order": "position"})
    first = imgs[0]["src"] if imgs else None
    entry = {"handle": p["handle"], "title": p["title"], "images": len(imgs), "first": first}
    manifest.append(entry)
    if first:
        image = requests.get(first, timeout=40)
        # Verify before caching: an error page written out as `.webp` passes the
        # later visual check while showing nothing of the listing.
        image.raise_for_status()
        (OUT / f"{p['handle']}.webp").write_bytes(image.content)

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
print(f"{len(manifest)} listings, images cached in {OUT}")
for e in manifest:
    print(f"  {e['images']} img  {e['handle']}")
