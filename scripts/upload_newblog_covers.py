#!/usr/bin/env python3
"""Upload only missing new-blog covers (from /tmp/newblog_needs_img.json)."""
import sys, json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from utils.r2_helpers import configure_r2, upload_image  # noqa: E402
from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402

load_dotenv()
ROOT = Path(__file__).parent.parent
handles = json.load(open("/tmp/newblog_needs_img.json"))
print(f"to upload: {len(handles)}")
configure_r2()


def one(h):
    p = ROOT / "agnes-out" / "blog" / f"{h}.png"
    url, err = upload_image(f"blog/{h}", p.read_bytes(), content_type="image/png")
    return h, url, err


urls, errors = {}, []
with ThreadPoolExecutor(max_workers=4) as ex:
    for h, u, e in ex.map(one, handles):
        (urls.__setitem__(h, u) if not e else errors.append({"handle": h, "error": e}))
        print(f"{'OK ' if not e else 'FAIL'} {h}", flush=True)

base, secret = resolve_supabase_url(), resolve_supabase_secret_key()
ok = 0
for h, u in urls.items():
    r = requests.patch(f"{base}/rest/v1/articles?handle=eq.{h}",
                       headers={"apikey": secret, "Content-Type": "application/json"},
                       json={"storage_image_url": u}, timeout=30)
    ok += r.status_code in (200, 204)
print(f"linked {ok}/{len(urls)}, errors {len(errors)}")
