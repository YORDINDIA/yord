#!/usr/bin/env python3
"""Upload Agnes product angle shots to R2 + insert product_images rows."""
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from utils.r2_helpers import configure_r2, upload_image  # noqa: E402
from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402

load_dotenv()
ROOT = Path(__file__).parent.parent
PDIR = ROOT / "agnes-out" / "products"

configure_r2()
files = sorted(PDIR.glob("*__angle*.png"))
print(f"angle shots: {len(files)}")


def one(p: Path):
    handle, _, ai = p.stem.partition("__angle")
    data = p.read_bytes()
    url, err = upload_image(f"products/{handle}/ai-angle-{ai}", data,
                            content_type="image/png")
    return handle, url, err


urls: dict[str, list[str]] = {}
errors = []
with ThreadPoolExecutor(max_workers=4) as ex:
    futs = {ex.submit(one, p): p for p in files}
    for f in as_completed(futs):
        h, u, e = f.result()
        if e:
            errors.append({"handle": h, "error": e})
        else:
            urls.setdefault(h, []).append(u)
        print(f"{'OK ' if not e else 'FAIL'} {h}", flush=True)

print(f"uploaded {sum(map(len, urls.values()))}, failed {len(errors)}")

base, secret = resolve_supabase_url(), resolve_supabase_secret_key()
H = {"apikey": secret, "Content-Type": "application/json",
     "Prefer": "resolution=merge-duplicates,return=minimal"}
r = requests.get(f"{base}/rest/v1/products?select=id,handle",
                 headers={"apikey": secret}, timeout=60)
pmap = {row["handle"]: row["id"] for row in r.json()}
r = requests.get(f"{base}/rest/v1/product_images?select=id&order=id.desc&limit=1",
                 headers={"apikey": secret}, timeout=60)
next_id = (r.json()[0]["id"] if r.json() else 0) + 1

rows = []
for h, us in urls.items():
    pid = pmap.get(h)
    if pid is None:
        errors.append({"handle": h, "error": "unknown product"})
        continue
    er = requests.get(f"{base}/rest/v1/product_images?product_id=eq.{pid}&select=position",
                      headers={"apikey": secret}, timeout=30)
    pos = max([x["position"] or 0 for x in er.json()] or [0])
    for u in sorted(us):
        pos += 1
        rows.append({"id": next_id, "product_id": pid, "position": pos,
                     "src": u, "storage_url": u,
                     "alt": "Additional studio view"})
        next_id += 1

ok = 0
for i in range(0, len(rows), 500):
    rr = requests.post(f"{base}/rest/v1/product_images", headers=H,
                       json=rows[i:i + 500], timeout=60)
    if rr.status_code in (200, 201, 204):
        ok += len(rows[i:i + 500])
    else:
        errors.append({"error": f"insert {rr.status_code}: {rr.text[:200]}"})
print(f"image rows inserted: {ok}/{len(rows)}")
if errors:
    print("ERRORS:", errors[:10])
