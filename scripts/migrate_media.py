#!/usr/bin/env python3
"""
Media Migration Script (REST API Version)
Downloads product images from Shopify and uploads to Cloudflare R2.
Uses Supabase REST API instead of direct database connection.
"""

import os
import sys
import json
import time
import requests
import tempfile
from pathlib import Path
from urllib.parse import urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from supabase import Client

sys.path.insert(0, str(Path(__file__).parent))
from utils.supabase_helpers import get_supabase_client
from utils.config import (
    resolve_r2_bucket,
    resolve_supabase_secret_key,
    resolve_supabase_url,
)
from utils.r2_helpers import upload_image

# Load environment variables
load_dotenv()

# Supabase configuration (URL falls back to NEXT_PUBLIC_SUPABASE_URL;
# see root .env.example). Cloudflare R2 holds the uploaded media.
SUPABASE_URL = resolve_supabase_url()
SUPABASE_SECRET_KEY = resolve_supabase_secret_key()
R2_BUCKET = resolve_r2_bucket()

# Migration settings
MAX_WORKERS = 5  # Parallel downloads
RETRY_ATTEMPTS = 3
RETRY_DELAY = 2
BATCH_SIZE = 50


class MediaMigrator:
    def __init__(self):
        self.supabase: Client = get_supabase_client()
        self.temp_dir = tempfile.mkdtemp(prefix='shopify_media_')
        self.stats = {
            'total_images': 0,
            'downloaded': 0,
            'uploaded': 0,
            'already_migrated': 0,
            'failed': 0,
            'errors': []
        }
        print(f"Temporary directory: {self.temp_dir}")

    def get_images_to_migrate(self) -> list:
        """Get all product images that haven't been migrated yet using REST API."""
        images = []
        offset = 0
        limit = 1000

        while True:
            # Query images without storage_url
            response = self.supabase.table('product_images').select(
                'id, product_id, src, alt, position'
            ).is_('storage_url', 'null').not_.is_('src', 'null').range(offset, offset + limit - 1).execute()

            if not response.data:
                break

            images.extend(response.data)
            offset += limit

            if len(response.data) < limit:
                break

        # Also get images with empty storage_url
        offset = 0
        while True:
            response = self.supabase.table('product_images').select(
                'id, product_id, src, alt, position'
            ).eq('storage_url', '').not_.is_('src', 'null').range(offset, offset + limit - 1).execute()

            if not response.data:
                break

            images.extend(response.data)
            offset += limit

            if len(response.data) < limit:
                break

        return images

    def get_already_migrated_count(self) -> int:
        """Get count of already migrated images using REST API."""
        # Count images where storage_url is not null and not empty
        response = self.supabase.table('product_images').select(
            'id', count='exact'
        ).not_.is_('storage_url', 'null').neq('storage_url', '').execute()

        return response.count if response.count else 0

    def download_image(self, url: str, image_id: int) -> tuple:
        """Download image from Shopify CDN."""
        # TODO: route this loop through utils.retry.retry_with_backoff
        # (honors Retry-After on 429 + jitter); left as-is to avoid
        # behavior change in the threaded download path without test cover.
        for attempt in range(RETRY_ATTEMPTS):
            try:
                # Parse URL to get filename
                parsed = urlparse(url)
                path = unquote(parsed.path)

                # Get original filename
                original_filename = os.path.basename(path)

                # Remove query params from filename if present
                if '?' in original_filename:
                    original_filename = original_filename.split('?')[0]

                # Get extension
                _, ext = os.path.splitext(original_filename)
                if not ext:
                    ext = '.jpg'  # Default to jpg if no extension

                # Create a clean filename
                filename = f"{image_id}{ext}"
                local_path = os.path.join(self.temp_dir, filename)

                # Download the image
                response = requests.get(url, timeout=30, stream=True)
                response.raise_for_status()

                # Get content type
                content_type = response.headers.get('content-type', 'image/jpeg')

                # Save to temp file
                with open(local_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

                return local_path, content_type, None

            except Exception as e:
                if attempt < RETRY_ATTEMPTS - 1:
                    time.sleep(RETRY_DELAY * (attempt + 1))
                else:
                    return None, None, str(e)

        return None, None, "Max retries exceeded"

    def upload_to_r2(self, local_path: str, product_id: int, image_id: int, content_type: str) -> tuple:
        """Upload image to Cloudflare R2."""
        # Object key: products/{product_id}/{image_id} (stored as a WebP variant)
        key = f"products/{product_id}/{image_id}"

        # Read file
        with open(local_path, 'rb') as f:
            file_data = f.read()

        return upload_image(key, file_data, content_type)

    def update_image_url(self, image_id: int, storage_url: str):
        """Update the product_images table with the new storage URL using REST API."""
        self.supabase.table('product_images').update({
            'storage_url': storage_url
        }).eq('id', image_id).execute()

    def migrate_single_image(self, image: dict) -> dict:
        """Migrate a single image."""
        image_id = image['id']
        product_id = image['product_id']
        src = image['src']

        result = {
            'image_id': image_id,
            'product_id': product_id,
            'success': False,
            'error': None,
            'storage_url': None
        }

        # Download image
        local_path, content_type, error = self.download_image(src, image_id)
        if error:
            result['error'] = f"Download failed: {error}"
            return result

        # Upload to R2
        storage_url, error = self.upload_to_r2(local_path, product_id, image_id, content_type)
        if error:
            result['error'] = f"Upload failed: {error}"
            # Clean up local file
            if local_path and os.path.exists(local_path):
                os.remove(local_path)
            return result

        # Update database
        try:
            self.update_image_url(image_id, storage_url)
            result['success'] = True
            result['storage_url'] = storage_url
        except Exception as e:
            result['error'] = f"DB update failed: {str(e)}"

        # Clean up local file
        if local_path and os.path.exists(local_path):
            os.remove(local_path)

        return result

    def migrate_images(self):
        """Main migration function."""
        print("\n" + "=" * 60)
        print("MEDIA MIGRATION: Shopify CDN -> Cloudflare R2")
        print("=" * 60)

        # Get already migrated count
        self.stats['already_migrated'] = self.get_already_migrated_count()
        print(f"\nImages already migrated: {self.stats['already_migrated']}")

        # Get images to migrate
        images = self.get_images_to_migrate()
        self.stats['total_images'] = len(images)

        if not images:
            print("\nNo images to migrate!")
            return

        print(f"Images to migrate: {self.stats['total_images']}")
        print(f"\nStarting migration with {MAX_WORKERS} workers...")
        print("-" * 60)

        # Process in batches for better progress tracking
        total_batches = (len(images) + BATCH_SIZE - 1) // BATCH_SIZE

        for batch_num in range(total_batches):
            start_idx = batch_num * BATCH_SIZE
            end_idx = min(start_idx + BATCH_SIZE, len(images))
            batch = images[start_idx:end_idx]

            print(f"\nBatch {batch_num + 1}/{total_batches} ({len(batch)} images)")

            # Process batch with thread pool
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = {executor.submit(self.migrate_single_image, img): img for img in batch}

                for future in as_completed(futures):
                    result = future.result()

                    if result['success']:
                        self.stats['uploaded'] += 1
                        url_preview = result['storage_url'][:60] if result['storage_url'] else ''
                        print(f"  [OK] Image {result['image_id']} -> {url_preview}...")
                    else:
                        self.stats['failed'] += 1
                        error_info = {
                            'image_id': result['image_id'],
                            'product_id': result['product_id'],
                            'error': result['error']
                        }
                        self.stats['errors'].append(error_info)
                        print(f"  [FAIL] Image {result['image_id']}: {result['error']}")

            # Progress update
            total_processed = self.stats['uploaded'] + self.stats['failed']
            print(f"  Progress: {total_processed}/{self.stats['total_images']} " +
                  f"({self.stats['uploaded']} OK, {self.stats['failed']} failed)")

    def print_summary(self):
        """Print migration summary."""
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"Already migrated (skipped): {self.stats['already_migrated']}")
        print(f"Total to migrate:           {self.stats['total_images']}")
        print(f"Successfully uploaded:      {self.stats['uploaded']}")
        print(f"Failed:                     {self.stats['failed']}")

        if self.stats['errors']:
            print(f"\n{len(self.stats['errors'])} errors occurred:")
            for err in self.stats['errors'][:10]:  # Show first 10 errors
                print(f"  - Image {err['image_id']}: {err['error']}")
            if len(self.stats['errors']) > 10:
                print(f"  ... and {len(self.stats['errors']) - 10} more errors")

            # Save errors to file
            error_file = os.path.join(os.path.dirname(__file__), 'media_migration_errors.json')
            with open(error_file, 'w') as f:
                json.dump(self.stats['errors'], f, indent=2)
            print(f"\nFull error log saved to: {error_file}")

        print("\n" + "=" * 60)

    def cleanup(self):
        """Clean up resources."""
        # Remove temp directory if empty
        try:
            os.rmdir(self.temp_dir)
        except OSError:
            pass  # Directory not empty, that's OK


def migrate_collection_images():
    """Migrate collection images to Cloudflare R2 using REST API."""
    print("\n" + "=" * 60)
    print("COLLECTION IMAGE MIGRATION")
    print("=" * 60)

    supabase = get_supabase_client()

    # Create local backup directory
    backup_dir = Path(__file__).parent.parent / 'data' / 'media' / 'collections'
    backup_dir.mkdir(parents=True, exist_ok=True)
    print(f"Local backup directory: {backup_dir}")

    # Get collections with Shopify CDN images (skip already migrated ones)
    response = supabase.table('collections').select('id, handle, image_src').not_.is_('image_src', 'null').neq('image_src', '').execute()

    # Filter to only Shopify CDN images
    collections = [c for c in (response.data or []) if c.get('image_src') and 'cdn.shopify.com' in c['image_src']]
    print(f"Collections with Shopify CDN images to migrate: {len(collections)}")

    migrated = 0
    failed = 0

    for collection in collections:
        coll_id = collection['id']
        handle = collection.get('handle', str(coll_id))
        src = collection['image_src']

        try:
            # Download image
            response = requests.get(src, timeout=30)
            response.raise_for_status()

            # Get extension from URL
            parsed = urlparse(src)
            path = unquote(parsed.path)
            _, ext = os.path.splitext(os.path.basename(path))
            if not ext:
                ext = '.jpg'

            # Save local backup with handle name for easier identification
            local_backup_path = backup_dir / f"{handle}{ext}"
            with open(local_backup_path, 'wb') as f:
                f.write(response.content)
            print(f"  [BACKUP] {handle} -> {local_backup_path}")

            # Upload to R2
            key = f"collections/{coll_id}"
            content_type = response.headers.get('content-type', 'image/jpeg')

            public_url, error = upload_image(key, response.content, content_type)
            if error:
                raise RuntimeError(error)

            # Track the migrated URL in storage_image_url; image_src keeps the
            # original Shopify URL (same shape as product_images / articles).
            supabase.table('collections').update({
                'storage_image_url': public_url
            }).eq('id', coll_id).execute()

            migrated += 1
            print(f"  [OK] Collection {handle} (id={coll_id})")

        except Exception as e:
            failed += 1
            print(f"  [FAIL] Collection {handle} (id={coll_id}): {e}")

    print(f"\nCollection images: {migrated} migrated, {failed} failed")


def main():
    """Main entry point."""
    # TODO: adopt utils.cli.create_parser() for shared
    # --dry-run/--execute/--checkpoint-file/--batch-size/--verbose flags.
    print("=" * 60)
    print("SHOPIFY TO R2 MEDIA MIGRATION")
    print("=" * 60)

    # Validate environment
    required_vars = ['SUPABASE_SECRET_KEY']
    missing = [var for var in required_vars if not os.getenv(var)]
    if not SUPABASE_URL:
        missing.insert(0, 'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)')
    if not R2_BUCKET:
        missing.append('R2_BUCKET')

    if missing:
        print(f"\nError: Missing required environment variables: {', '.join(missing)}")
        print("Please check your .env file")
        sys.exit(1)

    try:
        # Migrate product images
        migrator = MediaMigrator()
        migrator.migrate_images()
        migrator.print_summary()
        migrator.cleanup()

        # Migrate collection images
        migrate_collection_images()

        print("\n" + "=" * 60)
        print("MEDIA MIGRATION COMPLETE")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
