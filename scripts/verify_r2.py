#!/usr/bin/env python3
"""Check that the R2 credentials work end to end: put, publish, fetch, delete.

Run this before an ingest or a deploy so a wrong key, a missing bucket or a
non-public bucket surfaces here instead of halfway through an upload batch.
Reads the same `R2_*` variables the admin app and the migration scripts use
(see the root `.env.example`).

The probe is uploaded as `verify/<timestamp>.webp`, fetched through
`R2_PUBLIC_BASE_URL`, then deleted. Without `--execute` it only checks that the
configuration is complete.

Usage:
    python verify_r2.py            # validate credentials only (dry run)
    python verify_r2.py --execute  # put + fetch + delete a probe
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from utils.cli import create_parser, resolve_execute, configure_logging
from utils.config import (
    resolve_r2_access_key_id,
    resolve_r2_bucket,
    resolve_r2_endpoint,
    resolve_r2_public_base_url,
    resolve_r2_secret_access_key,
)
from utils.r2_helpers import (
    R2NotConfiguredError,
    configure_r2,
    delete_image,
    key_from_public_url,
    upload_image,
)

# 1x1 transparent PNG: the probe only has to be a valid image, and the upload
# path converts it to the WebP variant every other image gets.
PROBE_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d4944415478da63fcffff3f0300050001a2b3f30b0000000049454e"
    "44ae426082"
)


def main() -> int:
    parser = create_parser("Verify Cloudflare R2 credentials and public delivery")
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)

    try:
        client = configure_r2()
    except R2NotConfiguredError as error:
        print(f"FAIL: {error}")
        return 1

    bucket = resolve_r2_bucket()
    public_base = resolve_r2_public_base_url()
    print(f"OK: credentials present (bucket '{bucket}', endpoint {resolve_r2_endpoint()})")
    print(
        "OK: access key "
        f"'{resolve_r2_access_key_id()[:6]}…' with a {len(resolve_r2_secret_access_key())}-char secret"
    )

    if not public_base:
        print(
            "FAIL: R2_PUBLIC_BASE_URL is not set, so stored URLs would be empty. "
            "Enable the bucket's public development URL (R2 → bucket → Settings) "
            "or connect a custom domain, then copy the URL into .env"
        )
        return 1
    print(f"OK: public base URL {public_base}")

    key = f"verify/{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    if not execute:
        print(
            f"DRY-RUN: would upload a probe to '{key}', fetch the delivered URL, "
            "then delete it. Pass --execute to run it."
        )
        return 0

    url, error = upload_image(key, PROBE_PNG, "image/png")
    if error or not url:
        print(f"FAIL: upload rejected: {error}")
        return 1
    stored_key = key_from_public_url(url)
    print(f"OK: uploaded {stored_key}")

    try:
        response = requests.head(url, timeout=15, allow_redirects=True)
        if response.status_code == 405:  # some edge configs dislike HEAD
            response = requests.get(url, timeout=15, allow_redirects=True)
    except requests.RequestException as request_error:
        print(f"FAIL: delivery check could not reach the URL: {request_error}")
        delete_image(stored_key)
        return 1
    if response.status_code != 200:
        print(
            f"FAIL: delivered URL returned HTTP {response.status_code}. "
            "A 403 or 404 usually means the bucket is not public yet."
        )
        delete_image(stored_key)
        return 1
    print(
        f"OK: delivered {url} "
        f"(HTTP 200, {response.headers.get('content-type', 'unknown type')})"
    )

    if delete_image(stored_key):
        print(f"OK: deleted {stored_key}")
    else:
        print(f"WARN: could not delete {stored_key}; remove it by hand if it lingers")

    print(
        "\nCloudflare R2 is ready. Set the same R2_* variables on the admin "
        "site (see docs/deploy.md)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
