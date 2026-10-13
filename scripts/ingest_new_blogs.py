#!/usr/bin/env python3
"""Validate + ingest data/new_blogs/batch_*.json into articles."""
import json
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402

ROOT = Path(__file__).parent.parent
NB = ROOT / "data" / "new_blogs"


def response_rows(response, context: str) -> list[dict]:
    """Reject HTTP failures and unexpected PostgREST response shapes early."""
    if response.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"{context} request failed: HTTP {response.status_code}: "
            f"{getattr(response, 'text', '')[:300]}"
        )
    try:
        rows = response.json()
    except (ValueError, AttributeError) as exc:
        raise RuntimeError(f"{context} response was not valid JSON") from exc
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise RuntimeError(f"{context} response must be a JSON array of objects")
    return rows


def main() -> int:
    load_dotenv()
    base, secret = resolve_supabase_url(), resolve_supabase_secret_key()
    headers = {
        "apikey": secret,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    response = requests.get(
        f"{base}/rest/v1/articles?select=id,handle",
        headers={"apikey": secret},
        timeout=60,
    )
    existing = response_rows(response, "existing articles")
    if any("id" not in row or "handle" not in row for row in existing):
        raise RuntimeError("existing articles response rows require id and handle")
    e_handles = {row["handle"] for row in existing}
    e_ids = {row["id"] for row in existing}
    print(f"existing articles: {len(existing)}")

    all_rows = []
    for batch_file in sorted(NB.glob("batch_*.json")):
        with open(batch_file, encoding="utf-8") as f:
            rows = json.load(f)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError(f"{batch_file.name} must contain a JSON array of objects")
        print(f"{batch_file.name}: {len(rows)}")
        all_rows.extend(rows)

    print(f"total new: {len(all_rows)}")
    assert len({x["id"] for x in all_rows}) == len(all_rows), "dup ids in batches"
    assert len({x["handle"] for x in all_rows}) == len(all_rows), "dup handles in batches"
    clash_h = [x["handle"] for x in all_rows if x["handle"] in e_handles]
    clash_i = [x["id"] for x in all_rows if x["id"] in e_ids]
    assert not clash_h, f"handle clash: {clash_h}"
    assert not clash_i, f"id clash: {clash_i}"
    for row in all_rows:
        assert row["blog_id"] == 89876988081
        assert "<" in row["body_html"] and ">" in row["body_html"]
    print("validation OK")

    written = 0
    errors = 0
    for i in range(0, len(all_rows), 200):
        chunk = all_rows[i:i + 200]
        response = requests.post(
            f"{base}/rest/v1/articles",
            headers=headers,
            json=chunk,
            timeout=90,
        )
        if response.status_code in (200, 201, 204):
            written += len(chunk)
        else:
            errors += 1
            print("FAIL:", response.status_code, response.text[:300])
    print(f"ingested {written}/{len(all_rows)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
