"""Supabase helper functions for migration scripts."""

import logging
import os
from pathlib import Path
from typing import Any, Mapping, Sequence, TypedDict

from dotenv import load_dotenv
from supabase import Client, create_client

from .checkpoint import append_error

load_dotenv()

logger = logging.getLogger(__name__)


class ProductRecord(TypedDict, total=False):
    """Core `products` row shape (all fields optional for partial upserts)."""

    id: int
    title: str
    handle: str
    vendor: str
    product_type: str
    status: str
    tags: str
    body_html: str
    created_at: str
    updated_at: str
    published_at: str


class VariantRecord(TypedDict, total=False):
    """Core `product_variants` row shape (all fields optional)."""

    id: int
    product_id: int
    title: str
    sku: str
    price: float
    compare_at_price: float
    inventory_quantity: int
    created_at: str
    updated_at: str


# Any mapping with string keys upserts fine; the TypedDicts above document
# the two hottest tables for editors and reviewers.
SupabaseRecord = Mapping[str, Any]


def get_supabase_client() -> Client:
    """Create and return a Supabase client using environment variables.

    Returns:
        Client: Supabase client instance

    Raises:
        ValueError: If required environment variables are not set
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set"
        )

    return create_client(supabase_url, supabase_key)


def get_supabase_count(supabase: Client, table_name: str) -> int | None:
    """Get count of records in a Supabase table.

    Args:
        supabase: Supabase client instance
        table_name: Name of the table to count

    Returns:
        int | None: Number of records, or None if the query failed.
            Callers MUST distinguish None (query failed) from 0 (table empty).
    """
    try:
        response = supabase.table(table_name).select('*', count='exact').limit(0).execute()
        return response.count or 0
    except Exception as e:
        logger.error(f"Error counting table {table_name}: {e}")
        return None


def _record_id(record: SupabaseRecord) -> Any:
    return record.get("id", "?") if isinstance(record, Mapping) else "?"


def batch_upsert(
    supabase: Client,
    table_name: str,
    records: Sequence[SupabaseRecord],
    batch_size: int = 500,
    on_conflict: str = None,
    error_file: str | Path | None = None,
) -> tuple:
    """Insert or update records in batches.

    A failed batch falls back to per-record upserts so one bad row cannot
    sink the whole batch; each row that still fails is logged with its id
    and appended to the error log via ``utils.checkpoint.append_error``.

    Args:
        supabase: Supabase client instance
        table_name: Name of the table
        records: List of records to upsert
        batch_size: Number of records per batch (default 500 -- Supabase
            comfortably handles this; lower only on oversized rows)
        on_conflict: Column(s) to use for conflict resolution
        error_file: Where to append per-row failures
            (default: ``<table_name>_errors.json`` in the cwd)

    Returns:
        tuple: (success_count, error_count)
    """
    if error_file is None:
        error_file = Path.cwd() / f"{table_name}_errors.json"
    success_count = 0
    error_count = 0
    total_batches = (len(records) + batch_size - 1) // batch_size

    def _upsert(rows: list) -> None:
        if on_conflict:
            supabase.table(table_name).upsert(rows, on_conflict=on_conflict).execute()
        else:
            supabase.table(table_name).upsert(rows).execute()

    for i in range(0, len(records), batch_size):
        batch = list(records[i:i + batch_size])
        batch_num = i // batch_size + 1

        try:
            _upsert(batch)
            success_count += len(batch)
            logger.info(f"  Batch {batch_num}/{total_batches}: {len(batch)} records upserted")
        except Exception as batch_error:
            logger.warning(
                f"  Batch {batch_num}/{total_batches} failed ({batch_error}); "
                "retrying row-by-row..."
            )
            for record in batch:
                rid = _record_id(record)
                try:
                    _upsert([record])
                    success_count += 1
                except Exception as row_error:
                    error_count += 1
                    logger.error(f"  Row id={rid} in {table_name} failed: {row_error}")
                    try:
                        append_error(error_file, table_name, rid, row_error)
                    except Exception as log_error:
                        logger.error(f"  Could not append to {error_file}: {log_error}")

    return success_count, error_count


def table_exists(supabase: Client, table_name: str) -> bool:
    """Check if a table exists and is accessible.

    Args:
        supabase: Supabase client instance
        table_name: Name of the table to check

    Returns:
        bool: True if table exists and is accessible
    """
    try:
        supabase.table(table_name).select('*').limit(0).execute()
        return True
    except Exception:
        return False
