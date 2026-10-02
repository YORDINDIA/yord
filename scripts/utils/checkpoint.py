"""Shared checkpoint/resume + uniform error-log helpers for migration scripts.

Checkpoint file shape: {"completed_entities": [...], "source": {...}, "updated_at": iso}
Error log shape: [{"table": str, "id": value, "error": str, "ts": iso}]

Used by migrate_via_rest.py today; migrate_media.py / optimize_images.py still
keep their own checkpoint and error files (different names and shapes), so
operators still read more than one schema. append_error() is a
read-modify-write and is not safe to call from the threaded migrators.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def checkpoint_path(filename: str, script_dir: Path | str | None = None) -> Path:
    base = Path(script_dir) if script_dir else Path(__file__).resolve().parent.parent
    return base / filename


def load_checkpoint(filename: str, script_dir: Path | str | None = None) -> dict:
    path = checkpoint_path(filename, script_dir)
    if not path.exists():
        return {"completed_entities": []}
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data.setdefault("completed_entities", [])
            return data
        # Legacy shape: plain processed-id list -> wrap it
        return {"completed_entities": [], "processed_ids": data}
    except (json.JSONDecodeError, OSError):
        return {"completed_entities": []}


def save_checkpoint(filename: str, data: dict, script_dir: Path | str | None = None) -> None:
    path = checkpoint_path(filename, script_dir)
    data = {**data, "updated_at": _now()}
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def mark_entity_done(filename: str, entity: str, script_dir: Path | str | None = None) -> None:
    data = load_checkpoint(filename, script_dir)
    completed = data.get("completed_entities", [])
    if entity not in completed:
        completed.append(entity)
    data["completed_entities"] = completed
    save_checkpoint(filename, data, script_dir)


def is_entity_done(filename: str, entity: str, script_dir: Path | str | None = None) -> bool:
    return entity in load_checkpoint(filename, script_dir).get("completed_entities", [])


def clear_checkpoint(filename: str, script_dir: Path | str | None = None) -> None:
    path = checkpoint_path(filename, script_dir)
    if path.exists():
        path.unlink()


def append_error(error_file: Path | str, table: str, record_id, error: Exception | str) -> None:
    """Append one uniform {table, id, error, ts} record (atomic rewrite)."""
    path = Path(error_file)
    try:
        with open(path, "r") as f:
            errors = json.load(f)
        if not isinstance(errors, list):
            errors = []
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        errors = []
    errors.append({"table": table, "id": record_id, "error": str(error), "ts": _now()})
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(errors, f, indent=2)
    os.replace(tmp, path)
