#!/usr/bin/env python3
"""
Comprehensive Data Integrity Audit Script
Analyzes all tables for completeness and identifies issues.
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')


class DataAuditor:
    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'tables': {},
            'issues': [],
            'recommendations': []
        }

    def count_table(self, table_name):
        """Get count of records in a table."""
        try:
            response = self.supabase.table(table_name).select('*', count='exact').limit(0).execute()
            return response.count or 0
        except Exception as e:
            return f"ERROR: {str(e)}"

    def audit_customers(self):
        """Audit customer data completeness."""
        print("\n--- Auditing CUSTOMERS ---")

        total = self.count_table('customers')
        print(f"Total customers: {total}")

        if isinstance(total, str):  # Error
            self.results['tables']['customers'] = {'error': total}
            return

        # Get sample customers to check data
        sample = self.supabase.table('customers').select(
            'id, first_name, last_name, email, phone, orders_count, total_spent'
        ).limit(20).execute()

        # Count NULL/empty fields
        stats = {
            'total': total,
            'sample_data': [],
            'field_analysis': {}
        }

        # Analyze sample
        fields_with_data = {'first_name': 0, 'last_name': 0, 'email': 0, 'phone': 0}

        for customer in sample.data:
            stats['sample_data'].append({
                'id': customer['id'],
                'first_name': customer.get('first_name') or '[EMPTY]',
                'last_name': customer.get('last_name') or '[EMPTY]',
                'email': customer.get('email') or '[EMPTY]',
                'phone': customer.get('phone') or '[EMPTY]'
            })

            for field in fields_with_data:
                if customer.get(field) and customer.get(field).strip():
                    fields_with_data[field] += 1

        # Print sample data
        print("\nSample customer data (first 20):")
        print("-" * 80)
        for c in stats['sample_data'][:10]:
            print(f"  ID {c['id']}: {c['first_name']} {c['last_name']} | {c['email']} | {c['phone']}")

        # Field analysis
        print("\nField population in sample:")
        for field, count in fields_with_data.items():
            pct = count / len(sample.data) * 100 if sample.data else 0
            status = "OK" if pct >= 80 else "LOW" if pct >= 50 else "CRITICAL"
            print(f"  {field}: {count}/{len(sample.data)} ({pct:.1f}%) [{status}]")
            stats['field_analysis'][field] = {
                'sample_count': count,
                'sample_total': len(sample.data),
                'percentage': pct
            }

            if pct < 50:
                self.results['issues'].append({
                    'table': 'customers',
                    'field': field,
                    'issue': f'Only {pct:.1f}% populated in sample',
                    'severity': 'HIGH'
                })

        self.results['tables']['customers'] = stats

    def audit_customer_addresses(self):
        """Audit customer address data completeness."""
        print("\n--- Auditing CUSTOMER_ADDRESSES ---")

        total = self.count_table('customer_addresses')
        print(f"Total addresses: {total}")

        if isinstance(total, str):
            self.results['tables']['customer_addresses'] = {'error': total}
            return

        # Sample addresses
        sample = self.supabase.table('customer_addresses').select(
            'id, customer_id, first_name, last_name, address1, city, country, phone'
        ).limit(10).execute()

        print("\nSample addresses:")
        for addr in sample.data[:5]:
            print(f"  ID {addr['id']}: {addr.get('first_name', '')} {addr.get('last_name', '')} | "
                  f"{addr.get('address1', '[NO ADDRESS]')}, {addr.get('city', '')}, {addr.get('country', '')}")

        self.results['tables']['customer_addresses'] = {
            'total': total,
            'sample_count': len(sample.data)
        }

    def audit_product_images(self):
        """Audit product images for Supabase URL migration status."""
        print("\n--- Auditing PRODUCT_IMAGES ---")

        total = self.count_table('product_images')
        print(f"Total images: {total}")

        if isinstance(total, str):
            self.results['tables']['product_images'] = {'error': total}
            return

        # Count with supabase_url
        with_url = self.supabase.table('product_images').select(
            '*', count='exact'
        ).not_.is_('supabase_url', 'null').neq('supabase_url', '').limit(0).execute()
        migrated = with_url.count or 0

        # Count without supabase_url
        without_url = total - migrated

        print(f"Migrated to Supabase storage: {migrated}")
        print(f"Missing Supabase URL: {without_url}")
        print(f"Migration percentage: {migrated/total*100:.1f}%" if total > 0 else "N/A")

        # Sample of images without URL
        if without_url > 0:
            missing = self.supabase.table('product_images').select(
                'id, product_id, src'
            ).or_('supabase_url.is.null,supabase_url.eq.').limit(5).execute()

            print("\nImages without Supabase URL (sample):")
            for img in missing.data:
                print(f"  Image {img['id']} (Product {img['product_id']})")

        self.results['tables']['product_images'] = {
            'total': total,
            'migrated_to_supabase': migrated,
            'missing_supabase_url': without_url,
            'migration_percentage': round(migrated / total * 100, 2) if total > 0 else 0
        }

        if without_url > 10:
            self.results['issues'].append({
                'table': 'product_images',
                'issue': f'{without_url} images not migrated to Supabase storage',
                'severity': 'MEDIUM'
            })

    def audit_collects(self):
        """Audit collects table."""
        print("\n--- Auditing COLLECTS ---")

        count = self.count_table('collects')
        print(f"Total collects: {count}")

        self.results['tables']['collects'] = {'total': count}

        if count == 0:
            self.results['issues'].append({
                'table': 'collects',
                'issue': 'No product-collection relationships migrated',
                'severity': 'CRITICAL'
            })
            self.results['recommendations'].append(
                "Apply fix_collects_schema.sql and run remigrate_collects.py"
            )
            print("  [CRITICAL] Table is EMPTY - product-collection relationships missing!")

    def audit_inventory_levels(self):
        """Audit inventory levels."""
        print("\n--- Auditing INVENTORY_LEVELS ---")

        count = self.count_table('inventory_levels')
        print(f"Total inventory levels: {count}")

        self.results['tables']['inventory_levels'] = {'total': count}

        if isinstance(count, int) and count == 0:
            self.results['issues'].append({
                'table': 'inventory_levels',
                'issue': 'No inventory levels found',
                'severity': 'HIGH'
            })

    def audit_all_tables(self):
        """Get counts for all major tables."""
        print("\n--- TABLE COUNTS ---")

        tables = [
            'products', 'product_variants', 'product_options',
            'collections', 'smart_collection_rules',
            'orders', 'line_items', 'shipping_lines',
            'transactions', 'fulfillments', 'refunds',
            'locations', 'inventory_items',
            'price_rules', 'discount_codes',
            'metafields', 'order_billing_addresses', 'order_shipping_addresses'
        ]

        for table in tables:
            count = self.count_table(table)
            self.results['tables'][table] = {'total': count}
            status = "OK" if isinstance(count, int) and count > 0 else "EMPTY" if count == 0 else "ERROR"
            print(f"  {table:30} {str(count):>10} [{status}]")

    def run_full_audit(self):
        """Run complete audit."""
        print("=" * 60)
        print("COMPREHENSIVE DATA INTEGRITY AUDIT")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print("=" * 60)

        self.audit_all_tables()
        self.audit_customers()
        self.audit_customer_addresses()
        self.audit_product_images()
        self.audit_collects()
        self.audit_inventory_levels()

        # Print summary
        print("\n" + "=" * 60)
        print("AUDIT SUMMARY")
        print("=" * 60)

        print(f"\nIssues Found: {len(self.results['issues'])}")
        for issue in self.results['issues']:
            severity_icon = "[!!!]" if issue['severity'] == 'CRITICAL' else "[!!]" if issue['severity'] == 'HIGH' else "[!]"
            print(f"  {severity_icon} {issue.get('table', 'N/A')}: {issue['issue']}")

        if self.results['recommendations']:
            print("\nRecommendations:")
            for rec in self.results['recommendations']:
                print(f"  - {rec}")

        # Save results
        output_file = os.path.join(os.path.dirname(__file__), 'comprehensive_audit_results.json')
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"\nDetailed results saved to: {output_file}")

        return self.results


if __name__ == "__main__":
    auditor = DataAuditor()
    auditor.run_full_audit()
