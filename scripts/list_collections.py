#!/usr/bin/env python3
"""List all collections from Supabase to identify artist collections."""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

result = supabase.table('collections').select('id, title, handle, collection_type').order('title').execute()

print(f"Found {len(result.data)} collections:\n")
print(f"{'ID':<12} | {'Title':<40} | {'Handle':<40} | Type")
print("-" * 110)
for col in result.data:
    print(f"{col['id']:<12} | {col['title'] or '':<40} | {col['handle'] or '':<40} | {col['collection_type'] or ''}")
