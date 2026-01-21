#!/usr/bin/env python3
"""
Shopify to Supabase Migration Script (REST API Version)
Migrates all data from Shopify to Supabase using the REST API.
"""

import os
import sys
import json
import logging
import requests
from dotenv import load_dotenv
from datetime import datetime
from time import sleep
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('migration.log')
    ]
)
logger = logging.getLogger(__name__)

# ============================================================
# CONFIGURATION
# ============================================================

# Shopify configuration
STORE_NAME = os.getenv('SHOPIFY_STORE_NAME')
ACCESS_TOKEN = os.getenv('SHOPIFY_ADMIN_API_ACCESS_TOKEN')
API_VERSION = os.getenv('SHOPIFY_API_VERSION', '2025-01')
BASE_URL = f"https://{STORE_NAME}.myshopify.com/admin/api/{API_VERSION}"

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Request configuration
HEADERS = {
    'X-Shopify-Access-Token': ACCESS_TOKEN,
    'Content-Type': 'application/json'
}
BATCH_SIZE = int(os.getenv('BATCH_SIZE', '250'))
RETRY_LIMIT = 5
RETRY_WAIT = 2

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============================================================
# SHOPIFY API HELPERS
# ============================================================

def shopify_request(endpoint, params=None):
    """Make a GET request to Shopify API with retry logic."""
    url = f"{BASE_URL}/{endpoint}"
    retries = 0
    wait_time = RETRY_WAIT

    while retries < RETRY_LIMIT:
        try:
            response = requests.get(url, headers=HEADERS, params=params)

            if response.status_code == 200:
                return response.json(), response.headers

            if response.status_code == 429:  # Rate limited
                retry_after = int(response.headers.get('Retry-After', wait_time))
                logger.warning(f"Rate limited. Waiting {retry_after}s...")
                sleep(retry_after)
                retries += 1
                continue

            response.raise_for_status()

        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            retries += 1
            sleep(wait_time * retries)

    return None, None

def get_all_paginated(endpoint, key, params=None):
    """Fetch all items from a paginated Shopify endpoint."""
    all_items = []
    if params is None:
        params = {}
    params['limit'] = BATCH_SIZE

    while True:
        data, headers = shopify_request(endpoint, params)
        if not data or key not in data:
            break

        items = data[key]
        all_items.extend(items)
        logger.info(f"  Fetched {len(all_items)} {key}...")

        # Check for next page
        link_header = headers.get('Link', '') if headers else ''
        if 'rel="next"' not in link_header:
            break

        # Extract next page URL
        for link in link_header.split(','):
            if 'rel="next"' in link:
                next_url = link.split(';')[0].strip(' <>')
                # Extract page_info parameter
                if 'page_info=' in next_url:
                    page_info = next_url.split('page_info=')[1].split('&')[0]
                    params = {'limit': BATCH_SIZE, 'page_info': page_info}
                break

    return all_items

# ============================================================
# MIGRATION FUNCTIONS
# ============================================================

def migrate_locations():
    """Migrate inventory locations."""
    logger.info("Migrating locations...")

    data, _ = shopify_request("locations.json")
    if not data or 'locations' not in data:
        logger.warning("No locations found")
        return 0

    locations = data['locations']

    for loc in locations:
        record = {
            'id': loc['id'],
            'name': loc['name'],
            'active': loc.get('active', True),
            'legacy': loc.get('legacy', False),
            'address1': loc.get('address1'),
            'address2': loc.get('address2'),
            'city': loc.get('city'),
            'province': loc.get('province'),
            'province_code': loc.get('province_code'),
            'country': loc.get('country'),
            'country_code': loc.get('country_code'),
            'zip': loc.get('zip'),
            'phone': loc.get('phone'),
            'created_at': loc.get('created_at'),
            'updated_at': loc.get('updated_at')
        }

        try:
            supabase.table('locations').upsert(record).execute()
        except Exception as e:
            logger.error(f"Error inserting location {loc['id']}: {e}")

    logger.info(f"Migrated {len(locations)} locations")
    return len(locations)

def migrate_products():
    """Migrate products, variants, images, and options."""
    logger.info("Migrating products...")

    # Fetch all products (status=any doesn't work, so fetch each status separately)
    products = []

    # Get active products (default)
    active_products = get_all_paginated("products.json", "products", {})
    products.extend(active_products)
    logger.info(f"  Found {len(active_products)} active products")

    # Get draft products
    draft_products = get_all_paginated("products.json", "products", {'status': 'draft'})
    products.extend(draft_products)
    logger.info(f"  Found {len(draft_products)} draft products")

    # Get archived products
    archived_products = get_all_paginated("products.json", "products", {'status': 'archived'})
    products.extend(archived_products)
    logger.info(f"  Found {len(archived_products)} archived products")

    logger.info(f"  Total products to migrate: {len(products)}")

    product_count = 0
    variant_count = 0
    image_count = 0

    for product in products:
        # Insert product
        product_record = {
            'id': product['id'],
            'title': product['title'],
            'body_html': product.get('body_html'),
            'vendor': product.get('vendor'),
            'product_type': product.get('product_type'),
            'handle': product.get('handle'),
            'status': product.get('status', 'active'),
            'published_at': product.get('published_at'),
            'published_scope': product.get('published_scope', 'web'),
            'template_suffix': product.get('template_suffix'),
            'tags': product.get('tags'),
            'created_at': product.get('created_at'),
            'updated_at': product.get('updated_at')
        }

        try:
            supabase.table('products').upsert(product_record).execute()
            product_count += 1
        except Exception as e:
            logger.error(f"Error inserting product {product['id']}: {e}")
            continue

        # Insert variants
        for variant in product.get('variants', []):
            variant_record = {
                'id': variant['id'],
                'product_id': product['id'],
                'title': variant.get('title'),
                'price': float(variant.get('price', 0)) if variant.get('price') else None,
                'compare_at_price': float(variant.get('compare_at_price', 0)) if variant.get('compare_at_price') else None,
                'position': variant.get('position', 1),
                'sku': variant.get('sku'),
                'barcode': variant.get('barcode'),
                'grams': variant.get('grams'),
                'weight': float(variant.get('weight', 0)) if variant.get('weight') else None,
                'weight_unit': variant.get('weight_unit', 'kg'),
                'inventory_item_id': variant.get('inventory_item_id'),
                'inventory_quantity': variant.get('inventory_quantity', 0),
                'inventory_policy': variant.get('inventory_policy', 'deny'),
                'inventory_management': variant.get('inventory_management'),
                'fulfillment_service': variant.get('fulfillment_service', 'manual'),
                'requires_shipping': variant.get('requires_shipping', True),
                'taxable': variant.get('taxable', True),
                'option1': variant.get('option1'),
                'option2': variant.get('option2'),
                'option3': variant.get('option3'),
                'image_id': variant.get('image_id'),
                'created_at': variant.get('created_at'),
                'updated_at': variant.get('updated_at')
            }

            try:
                supabase.table('product_variants').upsert(variant_record).execute()
                variant_count += 1
            except Exception as e:
                logger.error(f"Error inserting variant {variant['id']}: {e}")

        # Insert images
        for image in product.get('images', []):
            image_record = {
                'id': image['id'],
                'product_id': product['id'],
                'position': image.get('position', 1),
                'src': image.get('src'),
                'alt': image.get('alt'),
                'width': image.get('width'),
                'height': image.get('height'),
                'created_at': image.get('created_at'),
                'updated_at': image.get('updated_at')
            }

            try:
                supabase.table('product_images').upsert(image_record).execute()
                image_count += 1
            except Exception as e:
                logger.error(f"Error inserting image {image['id']}: {e}")

        # Insert options
        for option in product.get('options', []):
            option_record = {
                'id': option['id'],
                'product_id': product['id'],
                'name': option.get('name'),
                'position': option.get('position', 1),
                'values': option.get('values')
            }

            try:
                supabase.table('product_options').upsert(option_record).execute()
            except Exception as e:
                logger.error(f"Error inserting option {option['id']}: {e}")

    logger.info(f"Migrated {product_count} products, {variant_count} variants, {image_count} images")
    return product_count

def migrate_customers():
    """Migrate customers and their addresses."""
    logger.info("Migrating customers...")

    customers = get_all_paginated("customers.json", "customers")

    customer_count = 0
    address_count = 0

    for customer in customers:
        customer_record = {
            'id': customer['id'],
            'email': customer.get('email'),
            'first_name': customer.get('first_name'),
            'last_name': customer.get('last_name'),
            'phone': customer.get('phone'),
            'state': customer.get('state', 'enabled'),
            'note': customer.get('note'),
            'tags': customer.get('tags'),
            'verified_email': customer.get('verified_email', False),
            'tax_exempt': customer.get('tax_exempt', False),
            'orders_count': customer.get('orders_count', 0),
            'total_spent': float(customer.get('total_spent', 0)) if customer.get('total_spent') else 0,
            'last_order_id': customer.get('last_order_id'),
            'last_order_name': customer.get('last_order_name'),
            'currency': customer.get('currency'),
            'accepts_marketing': customer.get('accepts_marketing', False),
            'created_at': customer.get('created_at'),
            'updated_at': customer.get('updated_at')
        }

        try:
            supabase.table('customers').upsert(customer_record).execute()
            customer_count += 1
        except Exception as e:
            logger.error(f"Error inserting customer {customer['id']}: {e}")
            continue

        # Insert addresses
        for addr in customer.get('addresses', []):
            addr_record = {
                'id': addr['id'],
                'customer_id': customer['id'],
                'first_name': addr.get('first_name'),
                'last_name': addr.get('last_name'),
                'company': addr.get('company'),
                'address1': addr.get('address1'),
                'address2': addr.get('address2'),
                'city': addr.get('city'),
                'province': addr.get('province'),
                'province_code': addr.get('province_code'),
                'country': addr.get('country'),
                'country_code': addr.get('country_code'),
                'zip': addr.get('zip'),
                'phone': addr.get('phone'),
                'is_default': addr.get('default', False)
            }

            try:
                supabase.table('customer_addresses').upsert(addr_record).execute()
                address_count += 1
            except Exception as e:
                logger.error(f"Error inserting address {addr['id']}: {e}")

    logger.info(f"Migrated {customer_count} customers, {address_count} addresses")
    return customer_count

def migrate_collections():
    """Migrate collections (smart and custom)."""
    logger.info("Migrating collections...")

    collection_count = 0

    # Smart collections
    smart_collections = get_all_paginated("smart_collections.json", "smart_collections")
    for col in smart_collections:
        record = {
            'id': col['id'],
            'title': col['title'],
            'handle': col.get('handle'),
            'body_html': col.get('body_html'),
            'collection_type': 'smart',
            'published_at': col.get('published_at'),
            'published_scope': col.get('published_scope', 'web'),
            'sort_order': col.get('sort_order'),
            'template_suffix': col.get('template_suffix'),
            'disjunctive': col.get('disjunctive'),
            'image_src': col.get('image', {}).get('src') if col.get('image') else None,
            'image_alt': col.get('image', {}).get('alt') if col.get('image') else None,
            'updated_at': col.get('updated_at')
        }

        try:
            supabase.table('collections').upsert(record).execute()
            collection_count += 1

            # Insert rules
            for i, rule in enumerate(col.get('rules', [])):
                rule_record = {
                    'collection_id': col['id'],
                    'column_name': rule.get('column'),
                    'relation': rule.get('relation'),
                    'condition': rule.get('condition')
                }
                try:
                    supabase.table('smart_collection_rules').insert(rule_record).execute()
                except Exception as e:
                    pass  # May already exist
        except Exception as e:
            logger.error(f"Error inserting smart collection {col['id']}: {e}")

    # Custom collections
    custom_collections = get_all_paginated("custom_collections.json", "custom_collections")
    for col in custom_collections:
        record = {
            'id': col['id'],
            'title': col['title'],
            'handle': col.get('handle'),
            'body_html': col.get('body_html'),
            'collection_type': 'custom',
            'published_at': col.get('published_at'),
            'published_scope': col.get('published_scope', 'web'),
            'sort_order': col.get('sort_order'),
            'template_suffix': col.get('template_suffix'),
            'image_src': col.get('image', {}).get('src') if col.get('image') else None,
            'image_alt': col.get('image', {}).get('alt') if col.get('image') else None,
            'updated_at': col.get('updated_at')
        }

        try:
            supabase.table('collections').upsert(record).execute()
            collection_count += 1
        except Exception as e:
            logger.error(f"Error inserting custom collection {col['id']}: {e}")

    logger.info(f"Migrated {collection_count} collections")
    return collection_count

def migrate_collects():
    """Migrate product-collection relationships."""
    logger.info("Migrating collects (product-collection links)...")

    collects = get_all_paginated("collects.json", "collects")
    count = 0

    for collect in collects:
        record = {
            'id': collect['id'],
            'collection_id': collect['collection_id'],
            'product_id': collect['product_id'],
            'position': collect.get('position'),
            'sort_value': collect.get('sort_value'),
            'created_at': collect.get('created_at')
        }

        try:
            supabase.table('collects').upsert(record).execute()
            count += 1
        except Exception as e:
            logger.error(f"Error inserting collect {collect['id']}: {e}")

    logger.info(f"Migrated {count} collects")
    return count

def migrate_price_rules_and_discounts():
    """Migrate price rules and discount codes."""
    logger.info("Migrating price rules and discount codes...")

    data, _ = shopify_request("price_rules.json", {'limit': 250})
    if not data or 'price_rules' not in data:
        logger.warning("No price rules found")
        return 0

    price_rules = data['price_rules']
    rule_count = 0
    code_count = 0

    for rule in price_rules:
        rule_record = {
            'id': rule['id'],
            'title': rule['title'],
            'value': float(rule.get('value', 0)),
            'value_type': rule.get('value_type'),
            'customer_selection': rule.get('customer_selection'),
            'target_type': rule.get('target_type'),
            'target_selection': rule.get('target_selection'),
            'allocation_method': rule.get('allocation_method'),
            'allocation_limit': rule.get('allocation_limit'),
            'once_per_customer': rule.get('once_per_customer', False),
            'usage_limit': rule.get('usage_limit'),
            'starts_at': rule.get('starts_at'),
            'ends_at': rule.get('ends_at'),
            'entitled_product_ids': rule.get('entitled_product_ids'),
            'entitled_variant_ids': rule.get('entitled_variant_ids'),
            'entitled_collection_ids': rule.get('entitled_collection_ids'),
            'prerequisite_product_ids': rule.get('prerequisite_product_ids'),
            'prerequisite_variant_ids': rule.get('prerequisite_variant_ids'),
            'prerequisite_collection_ids': rule.get('prerequisite_collection_ids'),
            'prerequisite_customer_ids': rule.get('prerequisite_customer_ids'),
            'created_at': rule.get('created_at'),
            'updated_at': rule.get('updated_at')
        }

        try:
            supabase.table('price_rules').upsert(rule_record).execute()
            rule_count += 1
        except Exception as e:
            logger.error(f"Error inserting price rule {rule['id']}: {e}")
            continue

        # Get discount codes for this rule
        codes_data, _ = shopify_request(f"price_rules/{rule['id']}/discount_codes.json")
        if codes_data and 'discount_codes' in codes_data:
            for code in codes_data['discount_codes']:
                code_record = {
                    'id': code['id'],
                    'price_rule_id': rule['id'],
                    'code': code['code'],
                    'usage_count': code.get('usage_count', 0),
                    'created_at': code.get('created_at'),
                    'updated_at': code.get('updated_at')
                }

                try:
                    supabase.table('discount_codes').upsert(code_record).execute()
                    code_count += 1
                except Exception as e:
                    logger.error(f"Error inserting discount code {code['id']}: {e}")

    logger.info(f"Migrated {rule_count} price rules, {code_count} discount codes")
    return rule_count

def migrate_orders():
    """Migrate orders with all related data."""
    logger.info("Migrating orders...")

    orders = get_all_paginated("orders.json", "orders", {'status': 'any'})

    order_count = 0
    line_item_count = 0

    for order in orders:
        # Main order record
        order_record = {
            'id': order['id'],
            'customer_id': order.get('customer', {}).get('id') if order.get('customer') else None,
            'name': order['name'],
            'order_number': order.get('order_number'),
            'email': order.get('email'),
            'phone': order.get('phone'),
            'note': order.get('note'),
            'tags': order.get('tags'),
            'financial_status': order.get('financial_status'),
            'fulfillment_status': order.get('fulfillment_status'),
            'cancel_reason': order.get('cancel_reason'),
            'cancelled_at': order.get('cancelled_at'),
            'currency': order.get('currency'),
            'presentment_currency': order.get('presentment_currency'),
            'total_price': float(order.get('total_price', 0)),
            'subtotal_price': float(order.get('subtotal_price', 0)) if order.get('subtotal_price') else None,
            'total_line_items_price': float(order.get('total_line_items_price', 0)) if order.get('total_line_items_price') else None,
            'total_discounts': float(order.get('total_discounts', 0)) if order.get('total_discounts') else None,
            'total_tax': float(order.get('total_tax', 0)) if order.get('total_tax') else None,
            'total_weight': order.get('total_weight'),
            'taxes_included': order.get('taxes_included', False),
            'tax_exempt': order.get('tax_exempt', False),
            'buyer_accepts_marketing': order.get('buyer_accepts_marketing', False),
            'test': order.get('test', False),
            'browser_ip': order.get('browser_ip'),
            'customer_locale': order.get('customer_locale'),
            'landing_site': order.get('landing_site'),
            'referring_site': order.get('referring_site'),
            'source_name': order.get('source_name'),
            'confirmation_number': order.get('confirmation_number'),
            'token': order.get('token'),
            'order_status_url': order.get('order_status_url'),
            'location_id': order.get('location_id'),
            'created_at': order.get('created_at'),
            'processed_at': order.get('processed_at'),
            'closed_at': order.get('closed_at'),
            'updated_at': order.get('updated_at')
        }

        try:
            supabase.table('orders').upsert(order_record).execute()
            order_count += 1
        except Exception as e:
            logger.error(f"Error inserting order {order['id']}: {e}")
            continue

        # Billing address
        if order.get('billing_address'):
            ba = order['billing_address']
            ba_record = {
                'order_id': order['id'],
                'first_name': ba.get('first_name'),
                'last_name': ba.get('last_name'),
                'company': ba.get('company'),
                'address1': ba.get('address1'),
                'address2': ba.get('address2'),
                'city': ba.get('city'),
                'province': ba.get('province'),
                'province_code': ba.get('province_code'),
                'country': ba.get('country'),
                'country_code': ba.get('country_code'),
                'zip': ba.get('zip'),
                'phone': ba.get('phone'),
                'latitude': float(ba.get('latitude')) if ba.get('latitude') else None,
                'longitude': float(ba.get('longitude')) if ba.get('longitude') else None
            }
            try:
                supabase.table('order_billing_addresses').upsert(ba_record).execute()
            except Exception as e:
                pass

        # Shipping address
        if order.get('shipping_address'):
            sa = order['shipping_address']
            sa_record = {
                'order_id': order['id'],
                'first_name': sa.get('first_name'),
                'last_name': sa.get('last_name'),
                'company': sa.get('company'),
                'address1': sa.get('address1'),
                'address2': sa.get('address2'),
                'city': sa.get('city'),
                'province': sa.get('province'),
                'province_code': sa.get('province_code'),
                'country': sa.get('country'),
                'country_code': sa.get('country_code'),
                'zip': sa.get('zip'),
                'phone': sa.get('phone'),
                'latitude': float(sa.get('latitude')) if sa.get('latitude') else None,
                'longitude': float(sa.get('longitude')) if sa.get('longitude') else None
            }
            try:
                supabase.table('order_shipping_addresses').upsert(sa_record).execute()
            except Exception as e:
                pass

        # Line items
        for item in order.get('line_items', []):
            item_record = {
                'id': item['id'],
                'order_id': order['id'],
                'product_id': item.get('product_id'),
                'variant_id': item.get('variant_id'),
                'title': item.get('title'),
                'name': item.get('name'),
                'variant_title': item.get('variant_title'),
                'sku': item.get('sku'),
                'vendor': item.get('vendor'),
                'price': float(item.get('price', 0)) if item.get('price') else None,
                'quantity': item.get('quantity', 1),
                'current_quantity': item.get('current_quantity'),
                'fulfillable_quantity': item.get('fulfillable_quantity'),
                'total_discount': float(item.get('total_discount', 0)) if item.get('total_discount') else None,
                'grams': item.get('grams'),
                'requires_shipping': item.get('requires_shipping', True),
                'taxable': item.get('taxable', True),
                'gift_card': item.get('gift_card', False),
                'fulfillment_service': item.get('fulfillment_service'),
                'fulfillment_status': item.get('fulfillment_status'),
                'product_exists': item.get('product_exists', True),
                'currency': order.get('currency')
            }

            try:
                supabase.table('line_items').upsert(item_record).execute()
                line_item_count += 1
            except Exception as e:
                logger.error(f"Error inserting line item {item['id']}: {e}")

        # Shipping lines
        for shipping in order.get('shipping_lines', []):
            shipping_record = {
                'id': shipping['id'],
                'order_id': order['id'],
                'title': shipping.get('title'),
                'code': shipping.get('code'),
                'source': shipping.get('source'),
                'price': float(shipping.get('price', 0)) if shipping.get('price') else None,
                'discounted_price': float(shipping.get('discounted_price', 0)) if shipping.get('discounted_price') else None,
                'carrier_identifier': shipping.get('carrier_identifier'),
                'phone': shipping.get('phone'),
                'currency': order.get('currency')
            }
            try:
                supabase.table('shipping_lines').upsert(shipping_record).execute()
            except Exception as e:
                pass

        # Discount codes applied to order
        for dc in order.get('discount_codes', []):
            dc_record = {
                'order_id': order['id'],
                'code': dc.get('code'),
                'type': dc.get('type'),
                'amount': float(dc.get('amount', 0)) if dc.get('amount') else None
            }
            try:
                supabase.table('order_discount_codes').insert(dc_record).execute()
            except Exception as e:
                pass

    logger.info(f"Migrated {order_count} orders, {line_item_count} line items")
    return order_count

def migrate_transactions():
    """Migrate transactions for all orders."""
    logger.info("Migrating transactions...")

    # Get all order IDs
    orders = get_all_paginated("orders.json", "orders", {'status': 'any', 'fields': 'id'})

    transaction_count = 0

    for order in orders:
        order_id = order['id']
        data, _ = shopify_request(f"orders/{order_id}/transactions.json")

        if not data or 'transactions' not in data:
            continue

        for txn in data['transactions']:
            txn_record = {
                'id': txn['id'],
                'order_id': order_id,
                'parent_id': txn.get('parent_id'),
                'kind': txn.get('kind'),
                'status': txn.get('status'),
                'amount': float(txn.get('amount', 0)) if txn.get('amount') else None,
                'currency': txn.get('currency'),
                'gateway': txn.get('gateway'),
                'authorization_code': txn.get('authorization'),
                'authorization_expires_at': txn.get('authorization_expires_at'),
                'message': txn.get('message'),
                'error_code': txn.get('error_code'),
                'source_name': txn.get('source_name'),
                'payment_id': txn.get('payment_id'),
                'test': txn.get('test', False),
                'receipt': txn.get('receipt'),
                'created_at': txn.get('created_at'),
                'processed_at': txn.get('processed_at')
            }

            try:
                supabase.table('transactions').upsert(txn_record).execute()
                transaction_count += 1
            except Exception as e:
                logger.error(f"Error inserting transaction {txn['id']}: {e}")

    logger.info(f"Migrated {transaction_count} transactions")
    return transaction_count

def migrate_inventory():
    """Migrate inventory levels."""
    logger.info("Migrating inventory...")

    # Get locations
    loc_data, _ = shopify_request("locations.json")
    if not loc_data or 'locations' not in loc_data:
        return 0

    inventory_count = 0

    for loc in loc_data['locations']:
        location_id = loc['id']

        # Get inventory levels for this location
        inv_data, _ = shopify_request("inventory_levels.json", {
            'location_ids': location_id,
            'limit': 250
        })

        if not inv_data or 'inventory_levels' not in inv_data:
            continue

        for level in inv_data['inventory_levels']:
            # First ensure inventory item exists
            item_id = level['inventory_item_id']

            # Get inventory item details
            item_data, _ = shopify_request(f"inventory_items/{item_id}.json")
            if item_data and 'inventory_item' in item_data:
                item = item_data['inventory_item']
                item_record = {
                    'id': item['id'],
                    'sku': item.get('sku'),
                    'cost': float(item.get('cost', 0)) if item.get('cost') else None,
                    'tracked': item.get('tracked', True),
                    'requires_shipping': item.get('requires_shipping', True),
                    'country_code_of_origin': item.get('country_code_of_origin'),
                    'province_code_of_origin': item.get('province_code_of_origin'),
                    'harmonized_system_code': item.get('harmonized_system_code'),
                    'created_at': item.get('created_at'),
                    'updated_at': item.get('updated_at')
                }
                try:
                    supabase.table('inventory_items').upsert(item_record).execute()
                except Exception as e:
                    pass

            # Insert inventory level
            level_record = {
                'inventory_item_id': level['inventory_item_id'],
                'location_id': level['location_id'],
                'available': level.get('available', 0),
                'updated_at': level.get('updated_at')
            }

            try:
                supabase.table('inventory_levels').upsert(level_record).execute()
                inventory_count += 1
            except Exception as e:
                logger.error(f"Error inserting inventory level: {e}")

    logger.info(f"Migrated {inventory_count} inventory levels")
    return inventory_count

# ============================================================
# MAIN
# ============================================================

def main():
    """Run the migration."""
    print("=" * 60)
    print("SHOPIFY TO SUPABASE MIGRATION")
    print("=" * 60)
    print(f"Store: {STORE_NAME}.myshopify.com")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 60)

    # Validate environment
    if not STORE_NAME or not ACCESS_TOKEN:
        print("Error: Missing Shopify credentials")
        sys.exit(1)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing Supabase credentials")
        sys.exit(1)

    # Test Shopify connection
    print("\nTesting Shopify API...")
    shop_data, _ = shopify_request("shop.json")
    if not shop_data:
        print("Error: Could not connect to Shopify")
        sys.exit(1)
    print(f"Connected to: {shop_data.get('shop', {}).get('name', 'Unknown')}")

    # Run migrations in order
    results = {}

    print("\n" + "=" * 60)
    print("STARTING MIGRATION")
    print("=" * 60)

    results['locations'] = migrate_locations()
    results['products'] = migrate_products()
    results['customers'] = migrate_customers()
    results['collections'] = migrate_collections()
    results['collects'] = migrate_collects()
    results['price_rules'] = migrate_price_rules_and_discounts()
    results['orders'] = migrate_orders()
    results['transactions'] = migrate_transactions()
    results['inventory'] = migrate_inventory()

    # Summary
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETE")
    print("=" * 60)
    for entity, count in results.items():
        print(f"  {entity:20} {count:>6}")

    # Save results
    with open('migration_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'store': STORE_NAME,
            'results': results
        }, f, indent=2)

    print("\nResults saved to migration_results.json")
    print("Run migrate_media.py to migrate images to Supabase Storage")

if __name__ == "__main__":
    main()
