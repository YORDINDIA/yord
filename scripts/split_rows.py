#!/usr/bin/env python3
"""Split the entity JSON arrays into one file per row, keyed by handle.

Reads the archive-recovered arrays (``data/*.json``, or ``data/clean/`` with
``--source clean``) and writes one JSON file per row at
``data/rows/<kind>/<handle>.json``. ``handle`` is the filename key because it
is the only unique key every entity has: ``product_group_id`` is absent on 31
of 463 products, collections/concerts/artists/pages/policies carry no id at
all, and every blog's ``slug`` mirrors its ``handle``.

A folder of files loses array order, so ``data/rows/_index.json`` records the
per-kind handle order, the source file fingerprints, and any cross-reference
that no longer resolves. That index is what lets ``--verify`` reassemble each
kind and deep-compare it against the untouched source.

Outputs:
    data/rows/<kind>/<handle>.json   one row per file
    data/rows/_index.json            per-kind order + row/source fingerprints

Dry-run (default) prints the plan and writes nothing; ``--execute`` writes the
tree; ``--prune`` deletes row files whose handle is no longer in the source.

``_index.json`` keeps a SHA-256 per row, so ``--verify`` checks the tree
against the manifest even after the flat source files are removed, and against
the source itself whenever it is still there. ``--restore`` goes the other
way: it rebuilds ``data/<kind>.json`` byte-for-byte from the row tree, which
is what makes removing the flat files reversible.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils.cli import create_parser, resolve_execute, configure_logging

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"
CLEAN_DIR = DATA_DIR / "clean"
DEFAULT_OUT = DATA_DIR / "rows"
INDEX_NAME = "_index.json"
INDENT = 1

# kind -> source filename under data/; clean sources are resolved by stem.
KINDS = {
    "products": "products.json",
    "collections": "collections.json",
    "concerts": "concerts.json",
    "artists": "artists.json",
    "blogs": "blogs.json",
    "pages": "pages.json",
    "policies": "policies.json",
}

# Row fields holding lists of other products' handles (cross-references).
REF_FIELDS = ("products", "related_handles", "products_indirect")

UNSAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]")
MAX_STEM_BYTES = 200


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump_row(record) -> str:
    """Canonical row serialization: pipeline style (indent=1) + newline."""
    return json.dumps(record, ensure_ascii=False, indent=INDENT) + "\n"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def row_sha256(text: str) -> str:
    """Hash of a row file's exact text, so drift is detectable per row."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def dump_array(rows: list) -> str:
    """Flat source-file serialization: how the data/*.json writes looked."""
    return json.dumps(rows, ensure_ascii=False, indent=INDENT)


def resolve_sources(source: str, warn: bool = True) -> dict[str, Path]:
    """kind -> source path. ``clean`` prefers the enriched copies.

    ``warn=False`` is for verify/restore, where absent source files are the
    expected state (the flat files are removed once the tree is written).
    """
    found: dict[str, Path] = {}
    for kind, name in KINDS.items():
        stem = name[: -len(".json")]
        candidates = ([f"{stem}.enriched.json", f"{stem}.clean.json", name]
                      if source == "clean" else [name])
        directory = CLEAN_DIR if source == "clean" else DATA_DIR
        for candidate in candidates:
            path = directory / candidate
            if path.exists():
                found[kind] = path
                break
        else:
            if warn:
                logger.warning("no %s source for kind %r; skipped", source, kind)
    return found


def validate(kind: str, rows: list, path: Path) -> list[str]:
    """Filename-safety and uniqueness checks; any violation aborts the run."""
    problems: list[str] = []
    seen: dict[str, int] = {}
    for i, record in enumerate(rows):
        if not isinstance(record, dict):
            problems.append(f"{kind}[{i}]: row is not an object")
            continue
        handle = record.get("handle")
        if not isinstance(handle, str) or not handle:
            problems.append(f"{kind}[{i}]: missing handle")
            continue
        if handle in (".", ".."):
            problems.append(f"{kind}[{i}]: handle is a path segment: {handle!r}")
        if UNSAFE_FILENAME.search(handle):
            problems.append(f"{kind}[{i}]: handle not filename-safe: {handle!r}")
        if len(handle.encode()) > MAX_STEM_BYTES:
            problems.append(f"{kind}[{i}]: handle too long for a filename: {handle!r}")
        key = handle.lower()  # macOS filesystems are case-insensitive
        if key in seen:
            problems.append(
                f"{kind}: handle {handle!r} also used at row {seen[key]}"
                " (collides on a case-insensitive filesystem)")
        else:
            seen[key] = i
    if not rows:
        problems.append(f"{kind}: source {path} holds no rows")
    return problems


def row_path(out_dir: Path, kind: str, handle: str) -> Path:
    return out_dir / kind / f"{handle}.json"


def existing_rows(out_dir: Path, kind: str) -> set[str]:
    folder = out_dir / kind
    if not folder.is_dir():
        return set()
    return {p.stem for p in folder.glob("*.json")}


def collect_refs(rows_by_kind: dict[str, list]) -> list[tuple[str, str, str, str]]:
    """(kind, handle, field, referenced handle) for every list-of-handles field."""
    refs = []
    for kind, rows in rows_by_kind.items():
        for record in rows:
            for field in REF_FIELDS:
                values = record.get(field)
                if not isinstance(values, list):
                    continue
                for value in values:
                    if isinstance(value, str):
                        refs.append((kind, record.get("handle"), field, value))
    return refs


def dangling_refs(rows_by_kind: dict[str, list]) -> list[dict]:
    """References that point at a product handle no product row carries."""
    product_handles = {r.get("handle") for r in rows_by_kind.get("products", [])}
    missing = [{"from": f"{kind}:{handle}", "field": field, "ref": ref}
               for kind, handle, field, ref in collect_refs(rows_by_kind)
               if ref not in product_handles]
    return missing


def build_index(sources: dict[str, Path], rows_by_kind: dict[str, list],
                source: str) -> dict:
    kinds = {}
    for kind, rows in rows_by_kind.items():
        kinds[kind] = {
            "source_path": str(sources[kind].relative_to(REPO_ROOT)),
            "source_sha256": sha256_file(sources[kind]),
            "rows": len(rows),
            "order": [r["handle"] for r in rows],
            "row_sha256": {r["handle"]: row_sha256(dump_row(r)) for r in rows},
        }
    missing = dangling_refs(rows_by_kind)
    return {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source": source,
        "key": "handle",
        "total_rows": sum(len(rows) for rows in rows_by_kind.values()),
        "kinds": kinds,
        "dangling_refs": {"count": len(missing), "samples": missing[:20]},
    }


def write_tree(out_dir: Path, source: str, prune: bool) -> int:
    sources = resolve_sources(source)
    if not sources:
        print(f"ABORT: no {source} source files found under "
              f"{CLEAN_DIR if source == 'clean' else DATA_DIR}")
        print("       run --restore first to rebuild them from the row tree")
        return 1
    rows_by_kind = {kind: load_json(path) for kind, path in sources.items()}

    problems = [p for kind, rows in rows_by_kind.items()
                for p in validate(kind, rows, sources[kind])]
    if problems:
        print(f"ABORT: {len(problems)} validation problem(s); nothing written")
        for problem in problems[:20]:
            print(f"  - {problem}")
        return 1

    stale = {kind: sorted(existing_rows(out_dir, kind) - {r["handle"] for r in rows})
             for kind, rows in rows_by_kind.items()}

    written = unchanged = 0
    for kind, rows in rows_by_kind.items():
        for record in rows:
            path = row_path(out_dir, kind, record["handle"])
            payload = dump_row(record)
            if path.exists() and path.read_text(encoding="utf-8") == payload:
                unchanged += 1
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(payload, encoding="utf-8")
            written += 1

    removed = 0
    if prune:
        for kind, handles in stale.items():
            # Empty source already aborts above; this guards a wipe anyway.
            if not rows_by_kind.get(kind):
                continue
            for handle in handles:
                path = row_path(out_dir, kind, handle)
                path.unlink()
                removed += 1

    index = build_index(sources, rows_by_kind, source)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / INDEX_NAME).write_text(
        json.dumps(index, ensure_ascii=False, indent=INDENT) + "\n",
        encoding="utf-8")

    print(f"rows written: {written}  unchanged: {unchanged}")
    for kind, rows in rows_by_kind.items():
        print(f"  {kind:12} {len(rows):4} -> {out_dir / kind}")
    stale_total = sum(len(h) for h in stale.values())
    if prune:
        print(f"pruned stale row files: {removed}")
    elif stale_total:
        print(f"stale row files: {stale_total} (kept; pass --prune with --execute"
              " to delete)")
        for kind, handles in stale.items():
            if handles:
                print(f"  {kind:12} {len(handles):4} e.g. {handles[:3]}")
    print(f"dangling refs: {index['dangling_refs']['count']} "
          f"(recorded in {out_dir / INDEX_NAME})")
    return 0


def verify(out_dir: Path, source: str) -> int:
    """Check the tree against the manifest, and against the source when present.

    The per-row hashes in _index.json make the tree self-verifying, so this
    still works after the flat source files are removed.
    """
    index_path = out_dir / INDEX_NAME
    if not index_path.exists():
        print(f"FAIL: no {index_path}; run --execute first")
        return 1
    index = load_json(index_path)
    if index.get("source") != source:
        print(f"FAIL: {index_path} was built from --source {index['source']}; "
              f"re-run with --source {index['source']}, or re-split --out elsewhere")
        return 1
    sources = resolve_sources(source, warn=False)
    errors: list[str] = []
    tree_rows: dict[str, list] = {}

    for kind, entry in index["kinds"].items():
        order = entry["order"]
        hashes = entry.get("row_sha256") or {}
        unlisted = sorted(existing_rows(out_dir, kind) - set(order))
        if unlisted:
            errors.append(f"{kind}: {len(unlisted)} row file(s) not in the "
                          f"manifest, e.g. {unlisted[:3]}")
        rows: list = []
        for handle in order:
            path = row_path(out_dir, kind, handle)
            if not path.exists():
                errors.append(f"{kind}: missing row file {path}")
                break
            text = path.read_text(encoding="utf-8")
            if handle not in hashes:
                errors.append(f"{kind}/{handle}: no hash in {INDEX_NAME}; "
                              "re-run --execute")
                break
            if row_sha256(text) != hashes[handle]:
                errors.append(f"{kind}/{handle}: row file changed since the split")
                break
            try:
                rows.append(json.loads(text))
            except json.JSONDecodeError as exc:
                errors.append(f"{kind}/{handle}: invalid JSON ({exc})")
                break
        if len(rows) == len(order):
            tree_rows[kind] = rows

        src_path = sources.get(kind)
        if src_path is None:
            continue
        if entry.get("source_sha256") != sha256_file(src_path):
            errors.append(f"{kind}: source changed since the split "
                          f"({src_path}); re-run --execute")
        src_rows = load_json(src_path)
        if len(src_rows) != len(order):
            errors.append(f"{kind}: manifest holds {len(order)} handles, "
                          f"source has {len(src_rows)} rows")
        for i, expected in enumerate(src_rows):
            handle = expected["handle"]
            if i >= len(order) or order[i] != handle:
                errors.append(f"{kind}: manifest order diverges at row {i} "
                              f"(expected {handle!r})")
                break
            if i < len(rows) and dump_row(rows[i]) != dump_row(expected):
                differing = [k for k in set(expected) | set(rows[i])
                             if expected.get(k) != rows[i].get(k)]
                errors.append(f"{kind}/{handle}: fields differ: {differing[:5]}")
                break

    if not errors:
        missing = dangling_refs(tree_rows)
        if missing:
            errors.append(f"{len(missing)} cross-reference(s) do not resolve, "
                          f"e.g. {missing[0]}")
    if errors:
        print(f"FAIL: {len(errors)} problem(s)")
        for error in errors[:20]:
            print(f"  - {error}")
        return 1
    checked = (sum(len(load_json(p)) for p in sources.values()) if sources
               else sum(len(rows) for rows in tree_rows.values()))
    if sources:
        print(f"OK: {checked} rows round-trip ({len(sources)} kinds)")
    else:
        print(f"OK: {checked} rows match the manifest "
              f"({len(index['kinds'])} kinds; source files removed)")
    print(f"  row files on disk: "
          f"{sum(len(existing_rows(out_dir, k)) for k in index['kinds'])}")
    return 0


def restore(out_dir: Path, source: str, target_dir: Path, execute: bool) -> int:
    """Rebuild the flat source arrays from the row tree, byte-for-byte."""
    index_path = out_dir / INDEX_NAME
    if not index_path.exists():
        print(f"FAIL: no {index_path}; nothing to restore from")
        return 1
    index = load_json(index_path)
    if index.get("source") != source:
        print(f"FAIL: {index_path} was built from --source {index['source']}; "
              f"re-run with --source {index['source']}")
        return 1

    payloads: dict[str, str] = {}
    for kind, entry in index["kinds"].items():
        hashes = entry.get("row_sha256") or {}
        rows = []
        for handle in entry["order"]:
            path = row_path(out_dir, kind, handle)
            if not path.exists():
                print(f"FAIL: missing row file {path}")
                return 1
            text = path.read_text(encoding="utf-8")
            if hashes.get(handle) != row_sha256(text):
                print(f"FAIL: {path} changed since the split; refusing "
                      "to rebuild from it")
                return 1
            rows.append(json.loads(text))
        payloads[kind] = dump_array(rows)

    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")
    written = unchanged = 0
    for kind, payload in payloads.items():
        target = target_dir / f"{kind}.json"
        same = target.exists() and target.read_text(encoding="utf-8") == payload
        state = "identical" if same else ("overwrite" if target.exists() else "new")
        print(f"  {kind:12} {len(payload):>9} bytes -> {target}  [{state}]")
        if execute and not same:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(payload, encoding="utf-8")
            written += 1
        elif same:
            unchanged += 1
    if execute:
        print(f"restored: {written}  already identical: {unchanged}")
    return 0


def main() -> int:
    parser = create_parser("Split entity JSON arrays into one file per row")
    parser.add_argument("--out", default=str(DEFAULT_OUT),
                        help=f"Output folder (default: {DEFAULT_OUT})")
    parser.add_argument("--source", choices=("raw", "clean"), default="raw",
                        help="Read data/*.json (default) or data/clean/")
    parser.add_argument("--verify", action="store_true",
                        help="Check the row tree against the manifest/source; no writes")
    parser.add_argument("--restore", action="store_true",
                        help="Rebuild the flat source arrays from the row tree")
    parser.add_argument("--restore-to", default=str(DATA_DIR),
                        help=f"Folder for --restore (default: {DATA_DIR})")
    parser.add_argument("--prune", action="store_true",
                        help="With --execute: delete row files absent from the source")
    args = parser.parse_args()
    configure_logging(args.verbose)

    out_dir = Path(args.out)
    if args.restore:
        return restore(out_dir, args.source, Path(args.restore_to),
                       resolve_execute(args))
    if args.verify:
        return verify(out_dir, args.source)

    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")

    if not execute:
        sources = resolve_sources(args.source)
        if not sources:
            print(f"ABORT: no {args.source} source files found under "
                  f"{CLEAN_DIR if args.source == 'clean' else DATA_DIR}")
            print("       run --restore first to rebuild them from the row tree")
            return 1
        rows_by_kind = {kind: load_json(path) for kind, path in sources.items()}
        problems = [p for kind, rows in rows_by_kind.items()
                    for p in validate(kind, rows, sources[kind])]
        if problems:
            print(f"ABORT: {len(problems)} validation problem(s)")
            for problem in problems[:20]:
                print(f"  - {problem}")
            return 1
        total = sum(len(rows) for rows in rows_by_kind.values())
        print(f"source: {args.source}  target: {out_dir}")
        for kind, rows in rows_by_kind.items():
            stale = sorted(existing_rows(out_dir, kind) - {r["handle"] for r in rows})
            print(f"  {kind:12} {len(rows):4} rows -> {out_dir / kind}/<handle>.json"
                  + (f"  [{len(stale)} stale]" if stale else ""))
        missing = dangling_refs(rows_by_kind)
        print(f"total: {total} row files + {out_dir / INDEX_NAME}")
        print(f"dangling refs: {len(missing)}"
              + (f" e.g. {missing[0]}" if missing else ""))
        return 0

    return write_tree(out_dir, args.source, args.prune)


if __name__ == "__main__":
    raise SystemExit(main())
