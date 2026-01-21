#!/usr/bin/env python3
"""
Migration Verification Script (REST API Version)
Compares data between Shopify and Supabase to ensure migration integrity.
Uses Supabase REST API instead of direct database connection.
"""

import os
import sys
import json
import requests
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Shopify configuration
STORE_NAME = os.getenv('SHOPIFY_STORE_NAME')
ACCESS_TOKEN = os.getenv('SHOPIFY_ADMIN_API_ACCESS_TOKEN')
API_VERSION = os.getenv('SHOPIFY_API_VERSION', '2025-01')
SHOPIFY_BASE_URL = f"https://{STORE_NAME}.myshopify.com/admin/api/{API_VERSION}"
SHOPIFY_HEADERS = {
    'X-Shopify-Access-Token': ACCESS_TOKEN,
    'Content-Type': 'application/json'
}

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')


class MigrationVerifier:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'store': STORE_NAME,
            'counts': {},
            'discrepancies': [],
            'sample_checks': [],
            'relationship_checks': [],
            'media_checks': {},
            'overall_status': 'UNKNOWN'
        }

    def shopify_request(self, endpoint, params=None):
        """Make a GET request to Shopify API."""
        url = f"{SHOPIFY_BASE_URL}/{endpoint}"
        try:
            response = requests.get(url, headers=SHOPIFY_HEADERS, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"  Error fetching {endpoint}: {e}")
            return None

    def get_shopify_count(self, endpoint, params=None):
        """Get count from Shopify."""
        data = self.shopify_request(f"{endpoint}/count.json", params)
        if data:
            return data.get('count', 0)
        return -1

    def get_supabase_count(self, table):
        """Get count from Supabase using REST API."""
        try:
            response = self.supabase.table(table).select('id', count='exact').limit(1).execute()
            return response.count if response.count else 0
        except Exception as e:
            print(f"  Error counting {table}: {e}")
            return -1

    def verify_counts(self):
        """Verify row counts match between Shopify and Supabase."""
        print("\n" + "=" * 60)
        print("COUNT VERIFICATION")
        print("=" * 60)

        all_match = True

        # Products - need to count all statuses
        shopify_products = 0
        for status in ['active', 'draft', 'archived']:
            count_data = self.shopify_request("products/count.json", {'status': status})
            if count_data:
                shopify_products += count_data.get('count', 0)

        supabase_products = self.get_supabase_count('products')
        products_match = shopify_products == supabase_products

        if not products_match:
            all_match = False
            self.results['discrepancies'].append({
                'entity': 'Products',
                'shopify': shopify_products,
                'supabase': supabase_products,
                'difference': shopify_products - supabase_products
            })

        self.results['counts']['Products'] = {
            'shopify': shopify_products,
            'supabase': supabase_products,
            'match': products_match
        }
        print(f"  {'Products':20} Shopify: {shopify_products:>6} | Supabase: {supabase_products:>6} | [{'OK' if products_match else 'MISMATCH'}]")

        # Customers
        shopify_customers = self.get_shopify_count('customers')
        supabase_customers = self.get_supabase_count('customers')
        customers_match = shopify_customers == supabase_customers

        if not customers_match:
            all_match = False
            self.results['discrepancies'].append({
                'entity': 'Customers',
                'shopify': shopify_customers,
                'supabase': supabase_customers,
                'difference': shopify_customers - supabase_customers
            })

        self.results['counts']['Customers'] = {
            'shopify': shopify_customers,
            'supabase': supabase_customers,
            'match': customers_match
        }
        print(f"  {'Customers':20} Shopify: {shopify_customers:>6} | Supabase: {supabase_customers:>6} | [{'OK' if customers_match else 'MISMATCH'}]")

        # Orders (with status=any)
        orders_data = self.shopify_request("orders/count.json", {'status': 'any'})
        shopify_orders = orders_data.get('count', 0) if orders_data else -1
        supabase_orders = self.get_supabase_count('orders')
        orders_match = shopify_orders == supabase_orders

        if not orders_match:
            all_match = False
            self.results['discrepancies'].append({
                'entity': 'Orders',
                'shopify': shopify_orders,
                'supabase': supabase_orders,
                'difference': shopify_orders - supabase_orders
            })

        self.results['counts']['Orders'] = {
            'shopify': shopify_orders,
            'supabase': supabase_orders,
            'match': orders_match
        }
        print(f"  {'Orders':20} Shopify: {shopify_orders:>6} | Supabase: {supabase_orders:>6} | [{'OK' if orders_match else 'MISMATCH'}]")

        # Collections (custom + smart)
        shopify_custom = self.get_shopify_count('custom_collections')
        shopify_smart = self.get_shopify_count('smart_collections')
        shopify_collections = shopify_custom + shopify_smart
        supabase_collections = self.get_supabase_count('collections')
        collections_match = shopify_collections == supabase_collections

        if not collections_match:
            all_match = False
            self.results['discrepancies'].append({
                'entity': 'Collections',
                'shopify': shopify_collections,
                'supabase': supabase_collections,
                'difference': shopify_collections - supabase_collections
            })

        self.results['counts']['Collections'] = {
            'shopify': shopify_collections,
            'supabase': supabase_collections,
            'match': collections_match
        }
        print(f"  {'Collections':20} Shopify: {shopify_collections:>6} | Supabase: {supabase_collections:>6} | [{'OK' if collections_match else 'MISMATCH'}]")

        # Derived counts (Supabase only)
        print("\n  Derived Counts (Supabase only):")
        derived_tables = [
            ('product_variants', 'Product Variants'),
            ('product_images', 'Product Images'),
            ('customer_addresses', 'Customer Addresses'),
            ('line_items', 'Line Items'),
            ('transactions', 'Transactions'),
            ('price_rules', 'Price Rules'),
            ('discount_codes', 'Discount Codes'),
            ('locations', 'Locations'),
            ('inventory_levels', 'Inventory Levels'),
            ('collects', 'Collects'),
        ]

        for table, display_name in derived_tables:
            count = self.get_supabase_count(table)
            self.results['counts'][display_name] = {'supabase': count}
            print(f"    {display_name:25} {count:>6}")

        return all_match

    def verify_sample_products(self, sample_size=5):
        """Verify sample products match between Shopify and Supabase."""
        print("\n" + "=" * 60)
        print("SAMPLE PRODUCT VERIFICATION")
        print("=" * 60)

        # Get sample products from Shopify
        data = self.shopify_request("products.json", {'limit': sample_size})
        if not data or 'products' not in data:
            print("  Could not fetch sample products from Shopify")
            return False

        all_match = True

        for product in data['products']:
            product_id = product['id']
            shopify_title = product['title']
            shopify_variants = len(product.get('variants', []))
            shopify_images = len(product.get('images', []))

            # Check in Supabase
            response = self.supabase.table('products').select('*').eq('id', product_id).execute()
            supabase_product = response.data[0] if response.data else None

            if not supabase_product:
                print(f"  [MISSING] Product {product_id}: {shopify_title}")
                all_match = False
                self.results['sample_checks'].append({
                    'type': 'product',
                    'id': product_id,
                    'status': 'MISSING',
                    'shopify_title': shopify_title
                })
                continue

            # Verify title matches
            title_match = supabase_product['title'] == shopify_title

            # Count variants in Supabase
            variants_response = self.supabase.table('product_variants').select(
                'id', count='exact'
            ).eq('product_id', product_id).execute()
            supabase_variants = variants_response.count if variants_response.count else 0

            # Count images in Supabase
            images_response = self.supabase.table('product_images').select(
                'id', count='exact'
            ).eq('product_id', product_id).execute()
            supabase_images = images_response.count if images_response.count else 0

            variants_match = shopify_variants == supabase_variants
            images_match = shopify_images == supabase_images

            if title_match and variants_match and images_match:
                print(f"  [OK] Product {product_id}: {shopify_title[:40]}")
            else:
                all_match = False
                issues = []
                if not title_match:
                    issues.append(f"title mismatch")
                if not variants_match:
                    issues.append(f"variants ({shopify_variants} vs {supabase_variants})")
                if not images_match:
                    issues.append(f"images ({shopify_images} vs {supabase_images})")

                print(f"  [ISSUE] Product {product_id}: {', '.join(issues)}")

            self.results['sample_checks'].append({
                'type': 'product',
                'id': product_id,
                'title_match': title_match,
                'variants_match': variants_match,
                'images_match': images_match
            })

        return all_match

    def verify_sample_orders(self, sample_size=5):
        """Verify sample orders match between Shopify and Supabase."""
        print("\n" + "=" * 60)
        print("SAMPLE ORDER VERIFICATION")
        print("=" * 60)

        # Get sample orders from Shopify
        data = self.shopify_request("orders.json", {'limit': sample_size, 'status': 'any'})
        if not data or 'orders' not in data:
            print("  Could not fetch sample orders from Shopify")
            return False

        all_match = True

        for order in data['orders']:
            order_id = order['id']
            order_name = order['name']
            shopify_total = float(order['total_price'])
            shopify_line_items = len(order.get('line_items', []))

            # Check in Supabase
            response = self.supabase.table('orders').select('*').eq('id', order_id).execute()
            supabase_order = response.data[0] if response.data else None

            if not supabase_order:
                print(f"  [MISSING] Order {order_id}: {order_name}")
                all_match = False
                self.results['sample_checks'].append({
                    'type': 'order',
                    'id': order_id,
                    'status': 'MISSING',
                    'order_name': order_name
                })
                continue

            # Verify total matches
            supabase_total = float(supabase_order['total_price']) if supabase_order['total_price'] else 0
            total_match = abs(shopify_total - supabase_total) < 0.01

            # Count line items
            line_items_response = self.supabase.table('line_items').select(
                'id', count='exact'
            ).eq('order_id', order_id).execute()
            supabase_line_items = line_items_response.count if line_items_response.count else 0
            line_items_match = shopify_line_items == supabase_line_items

            if total_match and line_items_match:
                print(f"  [OK] Order {order_name}: ${shopify_total:.2f}, {shopify_line_items} items")
            else:
                all_match = False
                issues = []
                if not total_match:
                    issues.append(f"total (${shopify_total:.2f} vs ${supabase_total:.2f})")
                if not line_items_match:
                    issues.append(f"line_items ({shopify_line_items} vs {supabase_line_items})")

                print(f"  [ISSUE] Order {order_name}: {', '.join(issues)}")

            self.results['sample_checks'].append({
                'type': 'order',
                'id': order_id,
                'total_match': total_match,
                'line_items_match': line_items_match
            })

        return all_match

    def verify_media_migration(self):
        """Verify media has been migrated to Supabase Storage."""
        print("\n" + "=" * 60)
        print("MEDIA MIGRATION VERIFICATION")
        print("=" * 60)

        # Count total images with src
        total_response = self.supabase.table('product_images').select(
            'id', count='exact'
        ).not_.is_('src', 'null').execute()
        total_images = total_response.count if total_response.count else 0

        # Count migrated images
        migrated_response = self.supabase.table('product_images').select(
            'id', count='exact'
        ).not_.is_('supabase_url', 'null').neq('supabase_url', '').execute()
        migrated_images = migrated_response.count if migrated_response.count else 0

        migration_percentage = (migrated_images / total_images * 100) if total_images > 0 else 0

        print(f"  Total product images:    {total_images}")
        print(f"  Migrated to Supabase:    {migrated_images}")
        print(f"  Migration percentage:    {migration_percentage:.1f}%")

        self.results['media_checks'] = {
            'total_images': total_images,
            'migrated_images': migrated_images,
            'migration_percentage': migration_percentage
        }

        # Sample check: verify URLs are accessible
        sample_response = self.supabase.table('product_images').select(
            'supabase_url'
        ).not_.is_('supabase_url', 'null').neq('supabase_url', '').limit(5).execute()

        sample_urls = sample_response.data if sample_response.data else []

        if sample_urls:
            print("\n  Sample URL accessibility check:")
            accessible = 0
            for item in sample_urls:
                url = item['supabase_url']
                try:
                    response = requests.head(url, timeout=5)
                    if response.status_code == 200:
                        accessible += 1
                        print(f"    [OK] {url[:60]}...")
                    else:
                        print(f"    [FAIL] {url[:60]}... (Status: {response.status_code})")
                except Exception as e:
                    print(f"    [FAIL] {url[:60]}... (Error: {e})")

            self.results['media_checks']['sample_accessible'] = accessible
            self.results['media_checks']['sample_total'] = len(sample_urls)

        return migration_percentage >= 95  # Consider it passed if 95%+ migrated

    def print_summary(self):
        """Print verification summary."""
        print("\n" + "=" * 60)
        print("VERIFICATION SUMMARY")
        print("=" * 60)

        # Count issues
        count_issues = len(self.results['discrepancies'])
        sample_issues = sum(1 for s in self.results['sample_checks'] if s.get('status') == 'MISSING')

        print(f"\n  Count Discrepancies:     {count_issues}")
        print(f"  Missing Sample Records:  {sample_issues}")

        media_pct = self.results['media_checks'].get('migration_percentage', 0)
        print(f"  Media Migration:         {media_pct:.1f}%")

        # Overall status
        if count_issues == 0 and sample_issues == 0 and media_pct >= 95:
            self.results['overall_status'] = 'PASSED'
            print(f"\n  OVERALL STATUS: PASSED")
        elif count_issues > 5 or sample_issues > 2:
            self.results['overall_status'] = 'FAILED'
            print(f"\n  OVERALL STATUS: FAILED")
        else:
            self.results['overall_status'] = 'WARNING'
            print(f"\n  OVERALL STATUS: WARNING (minor issues detected)")

        # Save results
        output_file = os.path.join(os.path.dirname(__file__), 'verification_results.json')
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"\n  Detailed results saved to: {output_file}")


def main():
    """Main entry point."""
    print("=" * 60)
    print("SHOPIFY TO SUPABASE MIGRATION VERIFICATION")
    print(f"Store: {STORE_NAME}.myshopify.com")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 60)

    # Validate environment
    required_vars = ['SHOPIFY_STORE_NAME', 'SHOPIFY_ADMIN_API_ACCESS_TOKEN',
                     'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        print(f"\nError: Missing required environment variables: {', '.join(missing)}")
        print("Please check your .env file")
        sys.exit(1)

    try:
        verifier = MigrationVerifier()

        # Run all verification checks
        verifier.verify_counts()
        verifier.verify_sample_products()
        verifier.verify_sample_orders()
        verifier.verify_media_migration()

        # Print summary
        verifier.print_summary()

        print("\n" + "=" * 60)
        print("VERIFICATION COMPLETE")
        print("=" * 60)

        # Exit with appropriate code
        if verifier.results['overall_status'] == 'PASSED':
            sys.exit(0)
        elif verifier.results['overall_status'] == 'WARNING':
            sys.exit(0)  # Warnings are OK
        else:
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\nVerification interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
