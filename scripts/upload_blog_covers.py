#!/usr/bin/env python3
"""Upload Agnes blog covers to R2 (blog/<handle>.webp) and link articles."""
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
BLOG_DIR = ROOT / "agnes-out" / "blog"

configure_r2()
files = sorted(BLOG_DIR.glob("*.png"))
print(f"covers: {len(files)}")


def one(p: Path):
    handle = p.stem
    data = p.read_bytes()
    url, err = upload_image(f"blog/{handle}", data, content_type="image/png")
    return handle, url, err


urls: dict[str, str] = {}
errors = []
with ThreadPoolExecutor(max_workers=4) as ex:
    futs = {ex.submit(one, p): p for p in files}
    for f in as_completed(futs):
        h, u, e = f.result()
        if e:
            errors.append({"handle": h, "error": e})
        else:
            urls[h] = u
        print(f"{'OK ' if not e else 'FAIL'} {h}", flush=True)

print(f"uploaded {len(urls)}, failed {len(errors)}")

base, secret = resolve_supabase_url(), resolve_supabase_secret_key()
ok = 0
for h, u in urls.items():
    r = requests.patch(f"{base}/rest/v1/articles?handle=eq.{h}",
                       headers={"apikey": secret, "Content-Type": "application/json"},
                       json={"storage_image_url": u}, timeout=30)
    if r.status_code in (200, 204):
        ok += 1
    else:
        errors.append({"handle": h, "error": f"patch {r.status_code}: {r.text[:150]}"})
print(f"articles linked: {ok}/{len(urls)}")
if errors:
    print("ERRORS:", errors[:10])
