#!/usr/bin/env python3
"""
Unified Collection Population Script

Populates the collects table to link products to collections.
Combines functionality from:
- populate_collects.py (keyword matching)
- populate_smart_collection_collects.py (Shopify API fetching)
- fix_artist_collections.py (fuzzy search)

Usage:
    # Dry run with keyword matching for artist collections
    python scripts/populate_collections.py --mode=keyword --dry-run

    # Execute Shopify API mode for all collections
    python scripts/populate_collections.py --mode=shopify --execute

    # Target specific collections with fuzzy search
    python scripts/populate_collections.py --mode=search --collections=karan-aujla,coldplay --execute
"""

import os
import sys
import re
import random
import argparse
import logging
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Add parent directory to path for utils import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils import (
    ShopifyClient,
    get_supabase_client,
    ARTIST_COLLECTIONS,
    HOMEPAGE_ARTISTS,
    batch_upsert,
)
from scripts.utils.logging_config import setup_logging

load_dotenv()

logger = setup_logging(__name__)


class CollectionPopulator:
    """Handles collection-product linking via collects table."""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.supabase = get_supabase_client()
        self.shopify = ShopifyClient()
        self.stats = {
            'collections_processed': 0,
            'collects_created': 0,
            'collects_skipped': 0,
            'errors': 0,
        }

    def get_collections_from_db(self, handles: list = None) -> list:
        """Fetch collections from Supabase.

        Args:
            handles: Optional list of handles to filter by

        Returns:
            list: Collection records
        """
        query = self.supabase.table('collections').select('id, handle, title, collection_type')

        if handles:
            query = query.in_('handle', handles)

        response = query.execute()
        return response.data or []

    def get_all_products(self) -> list:
        """Fetch all products from Supabase."""
        all_products = []
        offset = 0
        limit = 1000

        while True:
            response = self.supabase.table('products').select(
                'id, title, vendor, tags, body_html, handle'
            ).range(offset, offset + limit - 1).execute()

            if not response.data:
                break

            all_products.extend(response.data)
            offset += limit

            if len(response.data) < limit:
                break

        return all_products

    def generate_collect_id(self, product_id: int) -> int:
        """Generate a unique collect ID."""
        return int(datetime.now().timestamp() * 1000) + random.randint(1000, 9999) + product_id

    def populate_by_keyword(self, collections: list = None) -> dict:
        """Populate collects using keyword matching.

        Matches products to artist collections based on keywords in
        product title, vendor, tags, body, and handle.

        Args:
            collections: Optional list of collection handles to process
        """
        logger.info("=" * 60)
        logger.info("MODE: Keyword Matching")
        logger.info("=" * 60)

        # Get target collections
        target_handles = collections or list(ARTIST_COLLECTIONS.keys())
        db_collections = self.get_collections_from_db(target_handles)
        collection_map = {c['handle']: c for c in db_collections}

        # Report found collections
        for handle in target_handles:
            if handle in collection_map:
                logger.info(f"  ✓ Found: {handle} -> {collection_map[handle]['title']}")
            else:
                logger.info(f"  ✗ Missing: {handle}")

        # Get all products
        products = self.get_all_products()
        logger.info(f"\nAnalyzing {len(products)} products...")

        # Match products to collections
        collects_to_insert = []
        matches_by_collection = {}

        for product in products:
            product_text = " ".join([
                str(product.get('title', '')),
                str(product.get('vendor', '')),
                str(product.get('tags', '')),
                str(product.get('body_html', '')),
                str(product.get('handle', '')),
            ]).lower()

            for handle in target_handles:
                if handle not in collection_map:
                    continue

                config = ARTIST_COLLECTIONS.get(handle, {})
                keywords = config.get('keywords', [])

                for keyword in keywords:
                    if keyword.lower() in product_text:
                        collects_to_insert.append({
                            'id': self.generate_collect_id(product['id']),
                            'collection_id': collection_map[handle]['id'],
                            'product_id': product['id'],
                            'position': 1,
                            'created_at': datetime.now().isoformat(),
                        })

                        if handle not in matches_by_collection:
                            matches_by_collection[handle] = []
                        matches_by_collection[handle].append({
                            'title': product['title'],
                            'keyword': keyword,
                        })
                        break  # Only match once per collection

        # Report results
        logger.info("\n" + "=" * 60)
        logger.info("MATCHES BY COLLECTION:")
        logger.info("=" * 60)
        for handle in target_handles:
            count = len(matches_by_collection.get(handle, []))
            logger.info(f"  {handle}: {count} products")

        logger.info(f"\nTotal: {len(collects_to_insert)} collects to insert")

        if not self.dry_run and collects_to_insert:
            logger.info("\nExecuting insert...")
            success, errors = batch_upsert(
                self.supabase, 'collects', collects_to_insert, batch_size=100,
                on_conflict='collection_id,product_id'
            )
            self.stats['collects_created'] = success
            self.stats['errors'] = errors
        else:
            logger.info("\n[DRY RUN] Use --execute to apply changes")

        return matches_by_collection

    def populate_from_shopify(self, collections: list = None) -> None:
        """Populate collects by fetching products from Shopify API.

        Fetches the actual product-collection associations from Shopify.

        Args:
            collections: Optional list of collection handles to process
        """
        logger.info("=" * 60)
        logger.info("MODE: Shopify API Fetch")
        logger.info("=" * 60)

        # Get collections from database
        db_collections = self.get_collections_from_db(collections)
        if not db_collections:
            logger.warning("No collections found in database")
            return

        logger.info(f"Processing {len(db_collections)} collections...")
        id_counter = 1000000000

        for collection in db_collections:
            collection_id = collection['id']
            title = collection['title']

            # Fetch products from Shopify
            products = self._fetch_products_for_collection(collection_id)

            if not products:
                logger.info(f"  No products for: {title}")
                continue

            collects_to_insert = []
            for position, product in enumerate(products):
                collects_to_insert.append({
                    'id': id_counter,
                    'collection_id': collection_id,
                    'product_id': product['id'],
                    'position': position,
                    'created_at': datetime.now().isoformat(),
                })
                id_counter += 1

            if not self.dry_run:
                success, errors = batch_upsert(
                    self.supabase, 'collects', collects_to_insert, batch_size=100,
                    on_conflict='collection_id,product_id'
                )
                self.stats['collects_created'] += success
                self.stats['errors'] += errors

            self.stats['collections_processed'] += 1
            logger.info(f"  {title}: {len(products)} products")

        self._print_summary()

    def _fetch_products_for_collection(self, collection_id: int) -> list:
        """Fetch all products for a collection from Shopify."""
        all_products = []
        params = {'limit': 250}
        endpoint = f"collections/{collection_id}/products.json"

        while True:
            data, headers = self.shopify.request(endpoint, params)
            if not data or 'products' not in data:
                break

            all_products.extend(data['products'])

            # Check for next page
            link = headers.get('Link', '') if headers else ''
            match = re.search(r'page_info=([^>]+)>; rel="next"', link)
            if not match:
                break

            params = {'limit': 250, 'page_info': match.group(1)}

        return all_products

    def populate_by_search(self, collections: list = None) -> None:
        """Populate collects using fuzzy search on vendor/tags/title.

        Args:
            collections: List of collection handles to target
        """
        logger.info("=" * 60)
        logger.info("MODE: Fuzzy Search")
        logger.info("=" * 60)

        target_handles = collections or HOMEPAGE_ARTISTS
        db_collections = self.get_collections_from_db(target_handles)
        collection_map = {c['handle']: c for c in db_collections}

        for handle in target_handles:
            if handle not in collection_map:
                logger.warning(f"Collection not found: {handle}")
                continue

            if handle not in ARTIST_COLLECTIONS:
                logger.warning(f"No config for: {handle}")
                continue

            collection = collection_map[handle]
            config = ARTIST_COLLECTIONS[handle]
            search_terms = config.get('search_terms', config.get('keywords', []))

            logger.info(f"\nProcessing: {collection['title']}")

            # Find products matching search terms
            matched_products = set()
            for term in search_terms:
                # Search in vendor
                response = self.supabase.table('products').select('id, title').ilike(
                    'vendor', f'%{term}%'
                ).execute()
                for p in response.data or []:
                    matched_products.add(p['id'])

                # Search in title
                response = self.supabase.table('products').select('id, title').ilike(
                    'title', f'%{term}%'
                ).execute()
                for p in response.data or []:
                    matched_products.add(p['id'])

                # Search in tags
                response = self.supabase.table('products').select('id, title').ilike(
                    'tags', f'%{term}%'
                ).execute()
                for p in response.data or []:
                    matched_products.add(p['id'])

            logger.info(f"  Found {len(matched_products)} matching products")

            if not self.dry_run and matched_products:
                collects = [
                    {
                        'id': self.generate_collect_id(pid),
                        'collection_id': collection['id'],
                        'product_id': pid,
                        'position': 1,
                        'created_at': datetime.now().isoformat(),
                    }
                    for pid in matched_products
                ]
                success, errors = batch_upsert(
                    self.supabase, 'collects', collects, batch_size=100,
                    on_conflict='collection_id,product_id'
                )
                self.stats['collects_created'] += success
                self.stats['errors'] += errors

            self.stats['collections_processed'] += 1

        self._print_summary()

    def _print_summary(self):
        """Print final statistics."""
        logger.info("\n" + "=" * 60)
        logger.info("SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Collections processed: {self.stats['collections_processed']}")
        logger.info(f"Collects created: {self.stats['collects_created']}")
        logger.info(f"Errors: {self.stats['errors']}")

        if self.dry_run:
            logger.info("\n[DRY RUN] Use --execute to apply changes")


def main():
    parser = argparse.ArgumentParser(
        description="Populate collects table to link products to collections"
    )
    parser.add_argument(
        '--mode',
        choices=['keyword', 'shopify', 'search'],
        required=True,
        help="Population mode: keyword (match by keywords), shopify (fetch from API), search (fuzzy search)"
    )
    parser.add_argument(
        '--collections',
        type=str,
        default=None,
        help="Comma-separated list of collection handles to target (default: all artist collections)"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        default=True,
        help="Preview changes without applying (default)"
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help="Apply changes to database"
    )

    args = parser.parse_args()

    # Parse collections
    collections = None
    if args.collections:
        collections = [h.strip() for h in args.collections.split(',')]

    # Determine dry run status
    dry_run = not args.execute

    logger.info(f"Starting collection population...")
    logger.info(f"Mode: {args.mode}")
    logger.info(f"Dry run: {dry_run}")
    if collections:
        logger.info(f"Target collections: {collections}")

    populator = CollectionPopulator(dry_run=dry_run)

    if args.mode == 'keyword':
        populator.populate_by_keyword(collections)
    elif args.mode == 'shopify':
        populator.populate_from_shopify(collections)
    elif args.mode == 'search':
        populator.populate_by_search(collections)


if __name__ == '__main__':
    main()
