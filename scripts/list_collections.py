#!/usr/bin/env python3
"""List all collections from Supabase to identify artist collections."""

import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))
from utils.supabase_helpers import get_supabase_client

supabase = get_supabase_client()

result = supabase.table('collections').select('id, title, handle, collection_type').order('title').execute()

print(f"Found {len(result.data)} collections:\n")
print(f"{'ID':<12} | {'Title':<40} | {'Handle':<40} | Type")
print("-" * 110)
for col in result.data:
    print(f"{col['id']:<12} | {col['title'] or '':<40} | {col['handle'] or '':<40} | {col['collection_type'] or ''}")
