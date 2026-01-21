#!/usr/bin/env python3
"""
Import customer PII data from Shopify CSV export to Supabase.
Updates existing customer records with first_name, last_name, email, etc.
Also creates customer_addresses records.
"""

import os
import csv
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Path to CSV file
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'customers_export.csv')


def import_customers():
    """Import customer PII from CSV and update Supabase."""
    print("=" * 60)
    print("IMPORT CUSTOMERS FROM CSV")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 60)

    # Read CSV
    print(f"\nReading CSV: {CSV_PATH}")
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        customers = list(reader)

    print(f"Found {len(customers)} customers in CSV")

    # Process customers
    updated_count = 0
    address_count = 0
    error_count = 0
    errors = []

    for idx, row in enumerate(customers):
        try:
            # Parse customer ID (strip leading apostrophe)
            customer_id_str = row.get('Customer ID', '').lstrip("'")
            if not customer_id_str:
                continue
            customer_id = int(customer_id_str)

            # Prepare customer update
            customer_update = {
                'first_name': row.get('First Name') or None,
                'last_name': row.get('Last Name') or None,
                'email': row.get('Email') or None,
                'phone': row.get('Phone') or None,
                'accepts_marketing': row.get('Accepts Email Marketing', '').lower() == 'yes',
                'tax_exempt': row.get('Tax Exempt', '').lower() == 'yes',
                'tags': row.get('Tags') or None,
            }

            # Parse total_spent and orders_count
            total_spent_str = row.get('Total Spent', '0')
            try:
                customer_update['total_spent'] = float(total_spent_str) if total_spent_str else 0.0
            except ValueError:
                customer_update['total_spent'] = 0.0

            orders_count_str = row.get('Total Orders', '0')
            try:
                customer_update['orders_count'] = int(orders_count_str) if orders_count_str else 0
            except ValueError:
                customer_update['orders_count'] = 0

            # Update customer
            result = supabase.table('customers').update(customer_update).eq('id', customer_id).execute()
            if result.data:
                updated_count += 1
            else:
                # Customer might not exist - try upsert with full record
                customer_update['id'] = customer_id
                customer_update['state'] = 'enabled'
                supabase.table('customers').upsert(customer_update).execute()
                updated_count += 1

            # Create customer address if address data exists
            address1 = row.get('Default Address Address1')
            city = row.get('Default Address City')

            if address1 or city:
                # Generate a unique address ID
                address_id = customer_id * 1000 + 1  # Simple ID generation

                address = {
                    'id': address_id,
                    'customer_id': customer_id,
                    'first_name': row.get('First Name') or None,
                    'last_name': row.get('Last Name') or None,
                    'company': row.get('Default Address Company') or None,
                    'address1': address1 or None,
                    'address2': row.get('Default Address Address2') or None,
                    'city': city or None,
                    'province_code': row.get('Default Address Province Code') or None,
                    'country_code': row.get('Default Address Country Code') or None,
                    'zip': row.get('Default Address Zip', '').lstrip("'") or None,
                    'phone': row.get('Default Address Phone', '').lstrip("'") or None,
                    'is_default': True,
                }

                try:
                    supabase.table('customer_addresses').upsert(address).execute()
                    address_count += 1
                except Exception as addr_err:
                    errors.append(f"Address for customer {customer_id}: {addr_err}")

            # Progress update
            if (idx + 1) % 100 == 0:
                print(f"  Processed {idx + 1}/{len(customers)} customers...")

        except Exception as e:
            error_count += 1
            errors.append(f"Customer {row.get('Customer ID', 'unknown')}: {e}")
            if error_count <= 5:
                print(f"  Error: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"Total in CSV: {len(customers)}")
    print(f"Customers updated: {updated_count}")
    print(f"Addresses created: {address_count}")
    print(f"Errors: {error_count}")

    # Verification
    print("\n--- Verification ---")
    result = supabase.table('customers').select('id, first_name, email', count='exact').limit(5).execute()
    print(f"Sample customers after import:")
    for c in result.data[:5]:
        print(f"  ID {c['id']}: {c.get('first_name')} | {c.get('email')}")

    # Count non-null fields
    all_customers = supabase.table('customers').select('first_name, email', count='exact').execute()
    with_name = sum(1 for c in all_customers.data if c.get('first_name'))
    with_email = sum(1 for c in all_customers.data if c.get('email'))
    print(f"\nCustomers with first_name: {with_name}/{all_customers.count}")
    print(f"Customers with email: {with_email}/{all_customers.count}")

    if errors and len(errors) <= 10:
        print("\nErrors encountered:")
        for err in errors[:10]:
            print(f"  - {err}")


if __name__ == "__main__":
    import_customers()
