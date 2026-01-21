"""Supabase helper functions for migration scripts."""

import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)


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


def get_supabase_count(supabase: Client, table_name: str) -> int:
    """Get count of records in a Supabase table.

    Args:
        supabase: Supabase client instance
        table_name: Name of the table to count

    Returns:
        int: Number of records, or 0 on error
    """
    try:
        response = supabase.table(table_name).select('*', count='exact').limit(0).execute()
        return response.count or 0
    except Exception as e:
        logger.error(f"Error counting table {table_name}: {e}")
        return 0


def batch_upsert(
    supabase: Client,
    table_name: str,
    records: list,
    batch_size: int = 100,
    on_conflict: str = None,
) -> tuple:
    """Insert or update records in batches.

    Args:
        supabase: Supabase client instance
        table_name: Name of the table
        records: List of records to upsert
        batch_size: Number of records per batch (default 100)
        on_conflict: Column(s) to use for conflict resolution

    Returns:
        tuple: (success_count, error_count)
    """
    success_count = 0
    error_count = 0
    total_batches = (len(records) + batch_size - 1) // batch_size

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        batch_num = i // batch_size + 1

        try:
            if on_conflict:
                query = supabase.table(table_name).upsert(batch, on_conflict=on_conflict)
            else:
                query = supabase.table(table_name).upsert(batch)
            query.execute()
            success_count += len(batch)
            logger.info(f"  Batch {batch_num}/{total_batches}: {len(batch)} records upserted")
        except Exception as e:
            error_count += len(batch)
            logger.error(f"  Batch {batch_num}/{total_batches} failed: {e}")

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
