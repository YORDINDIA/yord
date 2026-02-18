#!/usr/bin/env python3
"""
Comprehensive Media Migration Script

Migrates all Shopify media to Supabase Storage:
- Article featured images
- Article body HTML embedded images
- Metafield file references

Features:
- WebP conversion with compression
- Local backup before upload
- Checkpoint/resume capability
- Dry-run mode
- Parallel processing

Usage:
    python migrate_all_media.py                    # Full migration
    python migrate_all_media.py --dry-run          # Preview without changes
    python migrate_all_media.py --resume           # Resume from checkpoint
    python migrate_all_media.py --sample 10        # Test with 10 items
    python migrate_all_media.py --articles-only    # Only article featured images
    python migrate_all_media.py --body-only        # Only body HTML images
    python migrate_all_media.py --metafields-only  # Only metafield files
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple, Any

from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from utils.image_processor import (
    ImageProcessor,
    BackupManager,
    StorageUploader,
    is_shopify_cdn_url,
    is_supabase_url,
    get_url_hash,
)
from utils.html_parser import (
    HTMLImageExtractor,
    HTMLImageReplacer,
    get_url_hash as html_get_url_hash,
)
from utils.supabase_helpers import get_supabase_client

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('media_migration.log')
    ]
)
logger = logging.getLogger(__name__)

# Configuration
STORAGE_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET', 'products')
MAX_WORKERS = 5
BATCH_SIZE = 50

# Storage paths
ARTICLES_STORAGE_PATH = 'articles'
ARTICLE_CONTENT_STORAGE_PATH = 'article-content'
METAFIELDS_STORAGE_PATH = 'metafields'


class ArticleFeaturedImageMigrator:
    """Migrates article featured images to Supabase Storage."""

    def __init__(
        self,
        supabase: Client,
        processor: ImageProcessor,
        backup_manager: BackupManager,
        uploader: StorageUploader,
        dry_run: bool = False
    ):
        self.supabase = supabase
        self.processor = processor
        self.backup = backup_manager
        self.uploader = uploader
        self.dry_run = dry_run

    def get_articles_to_migrate(self) -> List[Dict]:
        """Get articles with Shopify CDN images that haven't been migrated."""
        articles = []
        offset = 0
        limit = 1000

        while True:
            # Query articles with Shopify CDN images and no supabase_image_url
            response = self.supabase.table('articles').select(
                'id, blog_id, title, image_src, image_alt'
            ).like(
                'image_src', '%cdn.shopify.com%'
            ).or_(
                'supabase_image_url.is.null,supabase_image_url.eq.'
            ).range(offset, offset + limit - 1).execute()

            if not response.data:
                break

            articles.extend(response.data)
            offset += limit

            if len(response.data) < limit:
                break

        return articles

    def migrate_single_article(self, article: Dict) -> Dict:
        """Migrate a single article's featured image."""
        result = {
            'id': article['id'],
            'title': article.get('title', 'Unknown'),
            'success': False,
            'error': None,
            'actions': []
        }

        try:
            image_src = article.get('image_src')
            if not image_src:
                result['error'] = 'No image_src'
                return result

            # Download image
            image_data, content_type, error = self.processor.download_image(image_src)
            if error:
                result['error'] = f'Download failed: {error}'
                return result

            result['original_size_kb'] = round(len(image_data) / 1024, 2)

            # Get original extension
            ext = self.processor.get_extension_from_url(image_src)

            # Create local backup
            if not self.dry_run:
                self.backup.create_backup(
                    image_data,
                    'articles',
                    str(article['id']),
                    f'featured{ext}'
                )
                result['actions'].append('backup_created')

            # Convert to WebP
            webp_data, quality = self.processor.convert_to_webp(image_data)
            result['final_size_kb'] = round(len(webp_data) / 1024, 2)
            result['quality'] = quality
            result['actions'].append(f'converted_to_webp_q{quality}')

            if self.dry_run:
                result['success'] = True
                result['actions'].append('dry_run_skipped')
                return result

            # Upload to Supabase
            storage_path = f'{ARTICLES_STORAGE_PATH}/{article["id"]}.webp'
            public_url, error = self.uploader.upload_image(
                storage_path,
                webp_data,
                'image/webp'
            )

            if error:
                result['error'] = f'Upload failed: {error}'
                return result

            result['supabase_url'] = public_url
            result['actions'].append('uploaded_to_supabase')

            # Update database
            self.supabase.table('articles').update({
                'supabase_image_url': public_url
            }).eq('id', article['id']).execute()

            result['actions'].append('database_updated')
            result['success'] = True

        except Exception as e:
            result['error'] = str(e)

        return result


class ArticleBodyImageMigrator:
    """Migrates images embedded in article body_html."""

    def __init__(
        self,
        supabase: Client,
        processor: ImageProcessor,
        backup_manager: BackupManager,
        uploader: StorageUploader,
        dry_run: bool = False
    ):
        self.supabase = supabase
        self.processor = processor
        self.backup = backup_manager
        self.uploader = uploader
        self.dry_run = dry_run
        self.extractor = HTMLImageExtractor()
        self.replacer = HTMLImageReplacer()

        # Cache for migrated URLs to avoid re-uploading
        self.migrated_urls: Dict[str, str] = {}

    def get_articles_with_shopify_body_images(self) -> List[Dict]:
        """Get articles with Shopify CDN images in body_html."""
        articles = []
        offset = 0
        limit = 1000

        while True:
            response = self.supabase.table('articles').select(
                'id, title, body_html'
            ).like(
                'body_html', '%cdn.shopify.com%'
            ).range(offset, offset + limit - 1).execute()

            if not response.data:
                break

            articles.extend(response.data)
            offset += limit

            if len(response.data) < limit:
                break

        return articles

    def migrate_article_body_images(self, article: Dict) -> Dict:
        """Migrate all Shopify CDN images in article body_html."""
        result = {
            'id': article['id'],
            'title': article.get('title', 'Unknown'),
            'success': False,
            'error': None,
            'images_found': 0,
            'images_migrated': 0,
            'actions': []
        }

        try:
            body_html = article.get('body_html', '')
            if not body_html:
                result['error'] = 'No body_html'
                return result

            # Extract Shopify CDN URLs
            shopify_urls = self.extractor.extract_shopify_cdn_urls(body_html)
            result['images_found'] = len(shopify_urls)

            if not shopify_urls:
                result['success'] = True
                result['actions'].append('no_shopify_urls_found')
                return result

            # Migrate each image
            url_map = {}

            for url in shopify_urls:
                # Check if already migrated in this session
                if url in self.migrated_urls:
                    url_map[url] = self.migrated_urls[url]
                    continue

                new_url = self._migrate_single_body_image(article['id'], url)
                if new_url:
                    url_map[url] = new_url
                    self.migrated_urls[url] = new_url
                    result['images_migrated'] += 1

            result['actions'].append(f'migrated_{result["images_migrated"]}_images')

            if self.dry_run:
                result['success'] = True
                result['actions'].append('dry_run_skipped_db_update')
                return result

            # Update body_html with new URLs
            if url_map:
                new_body_html = self.replacer.replace_urls(body_html, url_map)

                self.supabase.table('articles').update({
                    'body_html': new_body_html
                }).eq('id', article['id']).execute()

                result['actions'].append('body_html_updated')

            result['success'] = True

        except Exception as e:
            result['error'] = str(e)

        return result

    def _migrate_single_body_image(
        self,
        article_id: int,
        url: str
    ) -> Optional[str]:
        """Migrate a single image from body_html."""
        try:
            # Download
            image_data, _, error = self.processor.download_image(url)
            if error:
                logger.warning(f'Failed to download {url}: {error}')
                return None

            # Get hash for deduplication
            url_hash = get_url_hash(url)
            ext = self.processor.get_extension_from_url(url)

            # Create backup
            if not self.dry_run:
                backup_path = self.backup.backup_dir / 'articles' / str(article_id) / 'content'
                backup_path.mkdir(parents=True, exist_ok=True)
                with open(backup_path / f'{url_hash}{ext}', 'wb') as f:
                    f.write(image_data)

            # Convert to WebP
            webp_data, _ = self.processor.convert_to_webp(image_data)

            if self.dry_run:
                return f'[DRY_RUN]{ARTICLE_CONTENT_STORAGE_PATH}/{article_id}/{url_hash}.webp'

            # Upload
            storage_path = f'{ARTICLE_CONTENT_STORAGE_PATH}/{article_id}/{url_hash}.webp'
            public_url, error = self.uploader.upload_image(
                storage_path,
                webp_data,
                'image/webp'
            )

            if error:
                logger.warning(f'Failed to upload {url}: {error}')
                return None

            return public_url

        except Exception as e:
            logger.warning(f'Error migrating body image {url}: {e}')
            return None


class MetafieldFileMigrator:
    """Migrates file references from metafields."""

    FILE_TYPES = ['file_reference', 'list.file_reference']

    def __init__(
        self,
        supabase: Client,
        processor: ImageProcessor,
        backup_manager: BackupManager,
        uploader: StorageUploader,
        dry_run: bool = False
    ):
        self.supabase = supabase
        self.processor = processor
        self.backup = backup_manager
        self.uploader = uploader
        self.dry_run = dry_run

    def get_metafields_with_shopify_files(self) -> List[Dict]:
        """Get metafields containing Shopify CDN file references."""
        metafields = []
        offset = 0
        limit = 1000

        while True:
            try:
                # Query metafields with file types and Shopify URLs
                # Note: supabase_url column may not exist, so we query without it
                response = self.supabase.table('metafields').select(
                    'id, owner_id, owner_resource, namespace, key, value, type'
                ).in_(
                    'type', self.FILE_TYPES
                ).like(
                    'value', '%cdn.shopify.com%'
                ).range(offset, offset + limit - 1).execute()

                if not response.data:
                    break

                metafields.extend(response.data)
                offset += limit

                if len(response.data) < limit:
                    break
            except Exception as e:
                # If query fails (e.g., no file_reference metafields), return empty
                logger.debug(f"Metafield query returned: {e}")
                break

        return metafields

    def migrate_single_metafield(self, metafield: Dict) -> Dict:
        """Migrate file reference in a single metafield."""
        result = {
            'id': metafield['id'],
            'owner_resource': metafield.get('owner_resource'),
            'owner_id': metafield.get('owner_id'),
            'namespace': metafield.get('namespace'),
            'key': metafield.get('key'),
            'success': False,
            'error': None,
            'actions': []
        }

        try:
            value = metafield.get('value', '')
            meta_type = metafield.get('type', '')

            # Extract URLs from value
            urls = self._extract_urls_from_value(value, meta_type)

            if not urls:
                result['error'] = 'No Shopify URLs found in value'
                return result

            # Migrate each URL
            url_map = {}

            for url in urls:
                if not is_shopify_cdn_url(url):
                    continue

                new_url = self._migrate_single_file(metafield, url)
                if new_url:
                    url_map[url] = new_url

            if not url_map:
                result['error'] = 'No files migrated'
                return result

            result['actions'].append(f'migrated_{len(url_map)}_files')

            if self.dry_run:
                result['success'] = True
                result['actions'].append('dry_run_skipped')
                return result

            # Update metafield value with new URLs
            new_value = value
            for old_url, new_url in url_map.items():
                new_value = new_value.replace(old_url, new_url)

            # Update only the value column (supabase_url column may not exist)
            self.supabase.table('metafields').update({
                'value': new_value
            }).eq('id', metafield['id']).execute()

            result['actions'].append('database_updated')
            result['success'] = True

        except Exception as e:
            result['error'] = str(e)

        return result

    def _extract_urls_from_value(self, value: str, meta_type: str) -> List[str]:
        """Extract URLs from metafield value."""
        urls = []

        # Try to parse as JSON for list types
        if meta_type == 'list.file_reference':
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    for item in parsed:
                        if isinstance(item, str) and is_shopify_cdn_url(item):
                            urls.append(item)
                        elif isinstance(item, dict) and 'url' in item:
                            if is_shopify_cdn_url(item['url']):
                                urls.append(item['url'])
            except json.JSONDecodeError:
                pass

        # Also check for direct URL or URL in value
        if is_shopify_cdn_url(value):
            urls.append(value)
        else:
            # Try to extract URLs using regex
            import re
            url_pattern = r'https?://cdn\.shopify\.com/[^\s"\'\<\>]+'
            matches = re.findall(url_pattern, value, re.IGNORECASE)
            urls.extend(matches)

        return list(set(urls))

    def _migrate_single_file(self, metafield: Dict, url: str) -> Optional[str]:
        """Migrate a single file from metafield."""
        try:
            # Download
            file_data, content_type, error = self.processor.download_image(url)
            if error:
                logger.warning(f'Failed to download {url}: {error}')
                return None

            ext = self.processor.get_extension_from_url(url)
            owner_resource = metafield.get('owner_resource', 'unknown')
            owner_id = metafield.get('owner_id', 0)
            metafield_id = metafield.get('id')

            # Create backup
            if not self.dry_run:
                backup_path = (
                    self.backup.backup_dir /
                    'metafields' /
                    owner_resource /
                    str(owner_id)
                )
                backup_path.mkdir(parents=True, exist_ok=True)
                with open(backup_path / f'{metafield_id}{ext}', 'wb') as f:
                    f.write(file_data)

            # Check if it's an image that should be converted
            image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp']
            if ext.lower() in image_extensions:
                webp_data, _ = self.processor.convert_to_webp(file_data)
                upload_data = webp_data
                upload_ext = '.webp'
                upload_content_type = 'image/webp'
            else:
                # Keep original format for non-images (PDFs, etc.)
                upload_data = file_data
                upload_ext = ext
                upload_content_type = content_type or 'application/octet-stream'

            if self.dry_run:
                return f'[DRY_RUN]{METAFIELDS_STORAGE_PATH}/{owner_resource}/{owner_id}/{metafield_id}{upload_ext}'

            # Upload
            storage_path = f'{METAFIELDS_STORAGE_PATH}/{owner_resource}/{owner_id}/{metafield_id}{upload_ext}'
            public_url, error = self.uploader.upload_image(
                storage_path,
                upload_data,
                upload_content_type
            )

            if error:
                logger.warning(f'Failed to upload metafield file: {error}')
                return None

            return public_url

        except Exception as e:
            logger.warning(f'Error migrating metafield file {url}: {e}')
            return None


class MediaMigrationOrchestrator:
    """Orchestrates the complete media migration process."""

    def __init__(self, dry_run: bool = False):
        self.supabase = get_supabase_client()
        self.processor = ImageProcessor()
        self.backup = BackupManager()
        self.uploader = StorageUploader(self.supabase, STORAGE_BUCKET)
        self.dry_run = dry_run

        # Initialize migrators
        self.article_featured_migrator = ArticleFeaturedImageMigrator(
            self.supabase, self.processor, self.backup, self.uploader, dry_run
        )
        self.article_body_migrator = ArticleBodyImageMigrator(
            self.supabase, self.processor, self.backup, self.uploader, dry_run
        )
        self.metafield_migrator = MetafieldFileMigrator(
            self.supabase, self.processor, self.backup, self.uploader, dry_run
        )

        # Checkpoint files
        self.script_dir = Path(__file__).parent
        self.checkpoint_file = self.script_dir / 'all_media_checkpoint.json'
        self.error_file = self.script_dir / 'all_media_errors.json'

        # Stats
        self.stats = {
            'article_featured': {'total': 0, 'success': 0, 'failed': 0, 'errors': []},
            'article_body': {'total': 0, 'success': 0, 'failed': 0, 'errors': []},
            'metafields': {'total': 0, 'success': 0, 'failed': 0, 'errors': []},
        }

    def save_checkpoint(self, phase: str, processed_ids: List[int]):
        """Save progress checkpoint."""
        data = {}
        if self.checkpoint_file.exists():
            with open(self.checkpoint_file, 'r') as f:
                data = json.load(f)

        data[phase] = {
            'timestamp': datetime.now().isoformat(),
            'processed_ids': processed_ids
        }

        with open(self.checkpoint_file, 'w') as f:
            json.dump(data, f, indent=2)

    def load_checkpoint(self, phase: str) -> List[int]:
        """Load checkpoint for a phase."""
        if not self.checkpoint_file.exists():
            return []

        with open(self.checkpoint_file, 'r') as f:
            data = json.load(f)

        return data.get(phase, {}).get('processed_ids', [])

    def run_full_migration(
        self,
        resume: bool = False,
        sample_size: int = 0,
        max_workers: int = MAX_WORKERS,
        articles_only: bool = False,
        body_only: bool = False,
        metafields_only: bool = False
    ):
        """Run the complete media migration."""
        print("\n" + "=" * 60)
        print("COMPREHENSIVE MEDIA MIGRATION")
        print("=" * 60)

        if self.dry_run:
            print("\n*** DRY RUN MODE - No changes will be made ***\n")

        # Run selected phases
        if articles_only or (not body_only and not metafields_only):
            self._migrate_article_featured_images(resume, sample_size, max_workers)

        if body_only or (not articles_only and not metafields_only):
            self._migrate_article_body_images(resume, sample_size, max_workers)

        if metafields_only or (not articles_only and not body_only):
            self._migrate_metafield_files(resume, sample_size, max_workers)

        self._print_summary()
        self._save_errors()

    def _migrate_article_featured_images(
        self,
        resume: bool,
        sample_size: int,
        max_workers: int
    ):
        """Phase 1: Migrate article featured images."""
        print("\n" + "-" * 40)
        print("PHASE 1: Article Featured Images")
        print("-" * 40)

        articles = self.article_featured_migrator.get_articles_to_migrate()
        self.stats['article_featured']['total'] = len(articles)

        print(f"Found {len(articles)} articles with unmigrated featured images")

        if not articles:
            print("No articles to migrate")
            return

        # Resume support
        processed_ids = []
        if resume:
            processed_ids = self.load_checkpoint('article_featured')
            articles = [a for a in articles if a['id'] not in processed_ids]
            print(f"Resuming: {len(processed_ids)} already processed, {len(articles)} remaining")

        if sample_size > 0:
            articles = articles[:sample_size]
            print(f"Sample mode: Processing {sample_size} articles")

        # Process
        with tqdm(total=len(articles), desc="Featured images") as pbar:
            for batch_start in range(0, len(articles), BATCH_SIZE):
                batch = articles[batch_start:batch_start + BATCH_SIZE]

                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = {
                        executor.submit(
                            self.article_featured_migrator.migrate_single_article, a
                        ): a for a in batch
                    }

                    for future in as_completed(futures):
                        result = future.result()
                        pbar.update(1)

                        if result['success']:
                            self.stats['article_featured']['success'] += 1
                            processed_ids.append(result['id'])
                        else:
                            self.stats['article_featured']['failed'] += 1
                            self.stats['article_featured']['errors'].append({
                                'id': result['id'],
                                'error': result['error']
                            })

                if not self.dry_run:
                    self.save_checkpoint('article_featured', processed_ids)

    def _migrate_article_body_images(
        self,
        resume: bool,
        sample_size: int,
        max_workers: int
    ):
        """Phase 2: Migrate article body HTML images."""
        print("\n" + "-" * 40)
        print("PHASE 2: Article Body HTML Images")
        print("-" * 40)

        articles = self.article_body_migrator.get_articles_with_shopify_body_images()
        self.stats['article_body']['total'] = len(articles)

        print(f"Found {len(articles)} articles with Shopify CDN images in body_html")

        if not articles:
            print("No articles to migrate")
            return

        # Resume support
        processed_ids = []
        if resume:
            processed_ids = self.load_checkpoint('article_body')
            articles = [a for a in articles if a['id'] not in processed_ids]
            print(f"Resuming: {len(processed_ids)} already processed, {len(articles)} remaining")

        if sample_size > 0:
            articles = articles[:sample_size]
            print(f"Sample mode: Processing {sample_size} articles")

        # Process (sequentially to handle body_html updates)
        for article in tqdm(articles, desc="Body images"):
            result = self.article_body_migrator.migrate_article_body_images(article)

            if result['success']:
                self.stats['article_body']['success'] += 1
                processed_ids.append(result['id'])
            else:
                self.stats['article_body']['failed'] += 1
                self.stats['article_body']['errors'].append({
                    'id': result['id'],
                    'error': result['error']
                })

            if not self.dry_run:
                self.save_checkpoint('article_body', processed_ids)

    def _migrate_metafield_files(
        self,
        resume: bool,
        sample_size: int,
        max_workers: int
    ):
        """Phase 3: Migrate metafield file references."""
        print("\n" + "-" * 40)
        print("PHASE 3: Metafield File References")
        print("-" * 40)

        metafields = self.metafield_migrator.get_metafields_with_shopify_files()
        self.stats['metafields']['total'] = len(metafields)

        print(f"Found {len(metafields)} metafields with Shopify CDN file references")

        if not metafields:
            print("No metafields to migrate")
            return

        # Resume support
        processed_ids = []
        if resume:
            processed_ids = self.load_checkpoint('metafields')
            metafields = [m for m in metafields if m['id'] not in processed_ids]
            print(f"Resuming: {len(processed_ids)} already processed, {len(metafields)} remaining")

        if sample_size > 0:
            metafields = metafields[:sample_size]
            print(f"Sample mode: Processing {sample_size} metafields")

        # Process
        with tqdm(total=len(metafields), desc="Metafield files") as pbar:
            for batch_start in range(0, len(metafields), BATCH_SIZE):
                batch = metafields[batch_start:batch_start + BATCH_SIZE]

                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = {
                        executor.submit(
                            self.metafield_migrator.migrate_single_metafield, m
                        ): m for m in batch
                    }

                    for future in as_completed(futures):
                        result = future.result()
                        pbar.update(1)

                        if result['success']:
                            self.stats['metafields']['success'] += 1
                            processed_ids.append(result['id'])
                        else:
                            self.stats['metafields']['failed'] += 1
                            self.stats['metafields']['errors'].append({
                                'id': result['id'],
                                'error': result['error']
                            })

                if not self.dry_run:
                    self.save_checkpoint('metafields', processed_ids)

    def _print_summary(self):
        """Print migration summary."""
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)

        for phase, stats in self.stats.items():
            if stats['total'] > 0:
                print(f"\n{phase.replace('_', ' ').title()}:")
                print(f"  Total:     {stats['total']}")
                print(f"  Success:   {stats['success']}")
                print(f"  Failed:    {stats['failed']}")

                if stats['errors']:
                    print(f"  Errors ({len(stats['errors'])}):")
                    for err in stats['errors'][:3]:
                        print(f"    - ID {err['id']}: {err['error']}")
                    if len(stats['errors']) > 3:
                        print(f"    ... and {len(stats['errors']) - 3} more")

        print("\n" + "=" * 60)

    def _save_errors(self):
        """Save error log."""
        all_errors = []
        for phase, stats in self.stats.items():
            for err in stats['errors']:
                all_errors.append({
                    'phase': phase,
                    **err
                })

        if all_errors:
            with open(self.error_file, 'w') as f:
                json.dump(all_errors, f, indent=2)
            print(f"\nError log saved to: {self.error_file}")


def main():
    parser = argparse.ArgumentParser(
        description='Comprehensive Shopify media migration to Supabase',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python migrate_all_media.py                    # Full migration
  python migrate_all_media.py --dry-run          # Preview without changes
  python migrate_all_media.py --resume           # Resume from checkpoint
  python migrate_all_media.py --sample 10        # Test with 10 items
  python migrate_all_media.py --articles-only    # Only article featured images
  python migrate_all_media.py --body-only        # Only body HTML images
  python migrate_all_media.py --metafields-only  # Only metafield files
        """
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview without making changes'
    )
    parser.add_argument(
        '--resume',
        action='store_true',
        help='Resume from previous checkpoint'
    )
    parser.add_argument(
        '--sample',
        type=int,
        default=0,
        help='Process only N items per phase (for testing)'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=MAX_WORKERS,
        help=f'Number of parallel workers (default: {MAX_WORKERS})'
    )
    parser.add_argument(
        '--articles-only',
        action='store_true',
        help='Only migrate article featured images'
    )
    parser.add_argument(
        '--body-only',
        action='store_true',
        help='Only migrate article body HTML images'
    )
    parser.add_argument(
        '--metafields-only',
        action='store_true',
        help='Only migrate metafield file references'
    )

    args = parser.parse_args()

    # Validate environment
    required_vars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        print(f"\nError: Missing required environment variables: {', '.join(missing)}")
        print("Please check your .env file")
        sys.exit(1)

    try:
        orchestrator = MediaMigrationOrchestrator(dry_run=args.dry_run)
        orchestrator.run_full_migration(
            resume=args.resume,
            sample_size=args.sample,
            max_workers=args.workers,
            articles_only=args.articles_only,
            body_only=args.body_only,
            metafields_only=args.metafields_only
        )

        print("\n" + "=" * 60)
        print("MEDIA MIGRATION COMPLETE")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
