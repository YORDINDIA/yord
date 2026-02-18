#!/usr/bin/env python3
"""
Media Migration Audit Script

Verifies the completeness of media migration:
- Checks article featured images migration status
- Scans body_html for remaining Shopify CDN URLs
- Checks metafield file references
- Verifies Supabase URLs are accessible
- Generates comprehensive report

Usage:
    python audit_media_migration.py              # Full audit
    python audit_media_migration.py --report     # Generate JSON report
    python audit_media_migration.py --verify     # Verify URL accessibility
    python audit_media_migration.py --sample 50  # Verify sample of URLs
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Any

import requests
from dotenv import load_dotenv
from tqdm import tqdm

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.supabase_helpers import get_supabase_client
from utils.html_parser import HTMLImageExtractor
from utils.image_processor import is_shopify_cdn_url, is_supabase_url

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Audit settings
MAX_WORKERS = 10
URL_TIMEOUT = 10


class MediaMigrationAuditor:
    """Audits the completeness of media migration."""

    def __init__(self, supabase_client=None):
        self.supabase = supabase_client or get_supabase_client()
        self.extractor = HTMLImageExtractor()

        self.results = {
            'timestamp': datetime.now().isoformat(),
            'product_images': {},
            'collection_images': {},
            'article_featured': {},
            'article_body': {},
            'metafields': {},
            'url_verification': {},
            'summary': {}
        }

    def run_full_audit(
        self,
        verify_urls: bool = False,
        sample_size: int = 0
    ) -> Dict:
        """Run complete audit of media migration."""
        print("\n" + "=" * 60)
        print("MEDIA MIGRATION AUDIT")
        print("=" * 60)

        # Run all checks
        self.audit_product_images()
        self.audit_collection_images()
        self.audit_article_featured_images()
        self.audit_article_body_images()
        self.audit_metafield_files()

        if verify_urls:
            self.verify_supabase_urls(sample_size)

        # Generate summary
        self._generate_summary()
        self._print_results()

        return self.results

    def audit_product_images(self) -> Dict:
        """Audit product images migration status."""
        print("\n" + "-" * 40)
        print("Auditing Product Images...")
        print("-" * 40)

        # Count total
        total_response = self.supabase.table('product_images').select(
            'id', count='exact'
        ).execute()
        total = total_response.count or 0

        # Count with Supabase URL
        migrated_response = self.supabase.table('product_images').select(
            'id', count='exact'
        ).not_.is_('supabase_url', 'null').neq('supabase_url', '').execute()
        migrated = migrated_response.count or 0

        # Count with Shopify URL still (not migrated)
        shopify_response = self.supabase.table('product_images').select(
            'id', count='exact'
        ).like('src', '%cdn.shopify.com%').or_(
            'supabase_url.is.null,supabase_url.eq.'
        ).execute()
        remaining = shopify_response.count or 0

        self.results['product_images'] = {
            'total': total,
            'migrated': migrated,
            'remaining': remaining,
            'percentage': round(migrated / total * 100, 2) if total > 0 else 100
        }

        print(f"  Total:     {total}")
        print(f"  Migrated:  {migrated} ({self.results['product_images']['percentage']}%)")
        print(f"  Remaining: {remaining}")

        return self.results['product_images']

    def audit_collection_images(self) -> Dict:
        """Audit collection images migration status."""
        print("\n" + "-" * 40)
        print("Auditing Collection Images...")
        print("-" * 40)

        # Count total with images
        total_response = self.supabase.table('collections').select(
            'id', count='exact'
        ).not_.is_('image_src', 'null').neq('image_src', '').execute()
        total = total_response.count or 0

        # Count with Supabase URL in image_src
        migrated_src = self.supabase.table('collections').select(
            'id', count='exact'
        ).like('image_src', '%supabase.co/storage%').execute()

        # Try to check supabase_image_url column (may not exist)
        try:
            migrated_col = self.supabase.table('collections').select(
                'id', count='exact'
            ).not_.is_('supabase_image_url', 'null').neq('supabase_image_url', '').execute()
            migrated = max(migrated_src.count or 0, migrated_col.count or 0)
        except Exception:
            # Column doesn't exist, just use image_src check
            migrated = migrated_src.count or 0

        # Count with Shopify URL still
        shopify_response = self.supabase.table('collections').select(
            'id', count='exact'
        ).like('image_src', '%cdn.shopify.com%').execute()
        remaining = shopify_response.count or 0

        self.results['collection_images'] = {
            'total': total,
            'migrated': migrated,
            'remaining': remaining,
            'percentage': round(migrated / total * 100, 2) if total > 0 else 100
        }

        print(f"  Total:     {total}")
        print(f"  Migrated:  {migrated} ({self.results['collection_images']['percentage']}%)")
        print(f"  Remaining: {remaining}")

        return self.results['collection_images']

    def audit_article_featured_images(self) -> Dict:
        """Audit article featured images migration status."""
        print("\n" + "-" * 40)
        print("Auditing Article Featured Images...")
        print("-" * 40)

        # Count total with images
        total_response = self.supabase.table('articles').select(
            'id', count='exact'
        ).not_.is_('image_src', 'null').neq('image_src', '').execute()
        total = total_response.count or 0

        # Count with Supabase URL
        migrated_response = self.supabase.table('articles').select(
            'id', count='exact'
        ).not_.is_('supabase_image_url', 'null').neq('supabase_image_url', '').execute()
        migrated = migrated_response.count or 0

        # Count with Shopify URL and no Supabase URL
        shopify_response = self.supabase.table('articles').select(
            'id', count='exact'
        ).like('image_src', '%cdn.shopify.com%').or_(
            'supabase_image_url.is.null,supabase_image_url.eq.'
        ).execute()
        remaining = shopify_response.count or 0

        self.results['article_featured'] = {
            'total': total,
            'migrated': migrated,
            'remaining': remaining,
            'percentage': round(migrated / total * 100, 2) if total > 0 else 100
        }

        print(f"  Total:     {total}")
        print(f"  Migrated:  {migrated} ({self.results['article_featured']['percentage']}%)")
        print(f"  Remaining: {remaining}")

        return self.results['article_featured']

    def audit_article_body_images(self) -> Dict:
        """Audit article body HTML for Shopify CDN images."""
        print("\n" + "-" * 40)
        print("Auditing Article Body Images...")
        print("-" * 40)

        # Get all articles with body_html
        articles_with_body = []
        offset = 0
        limit = 1000

        while True:
            response = self.supabase.table('articles').select(
                'id, body_html'
            ).not_.is_('body_html', 'null').neq('body_html', '').range(
                offset, offset + limit - 1
            ).execute()

            if not response.data:
                break

            articles_with_body.extend(response.data)
            offset += limit

            if len(response.data) < limit:
                break

        total = len(articles_with_body)
        articles_with_shopify_images = []
        total_shopify_urls = 0

        for article in articles_with_body:
            body_html = article.get('body_html', '')
            if body_html:
                shopify_urls = self.extractor.extract_shopify_cdn_urls(body_html)
                if shopify_urls:
                    articles_with_shopify_images.append({
                        'id': article['id'],
                        'shopify_url_count': len(shopify_urls)
                    })
                    total_shopify_urls += len(shopify_urls)

        remaining = len(articles_with_shopify_images)
        migrated = total - remaining

        self.results['article_body'] = {
            'total_articles_with_body': total,
            'articles_clean': migrated,
            'articles_with_shopify_urls': remaining,
            'total_shopify_urls_found': total_shopify_urls,
            'percentage': round(migrated / total * 100, 2) if total > 0 else 100,
            'details': articles_with_shopify_images[:10]  # First 10 for report
        }

        print(f"  Total articles with body:  {total}")
        print(f"  Clean (no Shopify URLs):   {migrated} ({self.results['article_body']['percentage']}%)")
        print(f"  With Shopify URLs:         {remaining}")
        print(f"  Total Shopify URLs found:  {total_shopify_urls}")

        return self.results['article_body']

    def audit_metafield_files(self) -> Dict:
        """Audit metafield file references migration status."""
        print("\n" + "-" * 40)
        print("Auditing Metafield File References...")
        print("-" * 40)

        FILE_TYPES = ['file_reference', 'list.file_reference']

        # Count total file-type metafields
        total = 0
        for file_type in FILE_TYPES:
            response = self.supabase.table('metafields').select(
                'id', count='exact'
            ).eq('type', file_type).execute()
            total += response.count or 0

        # Count with Shopify URLs
        remaining = 0
        for file_type in FILE_TYPES:
            response = self.supabase.table('metafields').select(
                'id', count='exact'
            ).eq('type', file_type).like('value', '%cdn.shopify.com%').execute()
            remaining += response.count or 0

        # Count with Supabase URLs in value (since supabase_url column may not exist)
        migrated = 0
        try:
            # Try to check supabase_url column first
            migrated_response = self.supabase.table('metafields').select(
                'id', count='exact'
            ).in_('type', FILE_TYPES).not_.is_('supabase_url', 'null').neq(
                'supabase_url', ''
            ).execute()
            migrated = migrated_response.count or 0
        except Exception:
            # Column doesn't exist, check value column for Supabase URLs instead
            for file_type in FILE_TYPES:
                response = self.supabase.table('metafields').select(
                    'id', count='exact'
                ).eq('type', file_type).like('value', '%supabase.co/storage%').execute()
                migrated += response.count or 0

        self.results['metafields'] = {
            'total': total,
            'migrated': migrated,
            'remaining_with_shopify': remaining,
            'percentage': round((total - remaining) / total * 100, 2) if total > 0 else 100
        }

        print(f"  Total file-type metafields: {total}")
        print(f"  Migrated:                   {migrated}")
        print(f"  With Shopify URLs:          {remaining}")

        return self.results['metafields']

    def verify_supabase_urls(self, sample_size: int = 50) -> Dict:
        """Verify that Supabase URLs are accessible."""
        print("\n" + "-" * 40)
        print("Verifying Supabase URL Accessibility...")
        print("-" * 40)

        # Collect sample URLs from different tables
        urls_to_check = []

        # Product images
        response = self.supabase.table('product_images').select(
            'id, supabase_url'
        ).not_.is_('supabase_url', 'null').neq('supabase_url', '').limit(
            sample_size // 3
        ).execute()
        for row in response.data or []:
            urls_to_check.append({
                'source': 'product_images',
                'id': row['id'],
                'url': row['supabase_url']
            })

        # Article featured images
        response = self.supabase.table('articles').select(
            'id, supabase_image_url'
        ).not_.is_('supabase_image_url', 'null').neq('supabase_image_url', '').limit(
            sample_size // 3
        ).execute()
        for row in response.data or []:
            urls_to_check.append({
                'source': 'articles',
                'id': row['id'],
                'url': row['supabase_image_url']
            })

        # Collections - check image_src for Supabase URLs (supabase_image_url column may not exist)
        try:
            response = self.supabase.table('collections').select(
                'id, supabase_image_url'
            ).not_.is_('supabase_image_url', 'null').neq('supabase_image_url', '').limit(
                sample_size // 3
            ).execute()
            for row in response.data or []:
                urls_to_check.append({
                    'source': 'collections',
                    'id': row['id'],
                    'url': row['supabase_image_url']
                })
        except Exception:
            # Fallback: check image_src for Supabase URLs
            response = self.supabase.table('collections').select(
                'id, image_src'
            ).like('image_src', '%supabase.co/storage%').limit(
                sample_size // 3
            ).execute()
            for row in response.data or []:
                urls_to_check.append({
                    'source': 'collections',
                    'id': row['id'],
                    'url': row['image_src']
                })

        if not urls_to_check:
            print("  No URLs to verify")
            self.results['url_verification'] = {
                'total_checked': 0,
                'accessible': 0,
                'failed': 0
            }
            return self.results['url_verification']

        # Check URLs in parallel
        accessible = 0
        failed = []

        def check_url(item):
            try:
                response = requests.head(item['url'], timeout=URL_TIMEOUT)
                return response.status_code == 200
            except Exception:
                return False

        print(f"  Checking {len(urls_to_check)} URLs...")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(check_url, item): item for item in urls_to_check}

            for future in tqdm(as_completed(futures), total=len(futures), desc="  Verifying"):
                item = futures[future]
                try:
                    if future.result():
                        accessible += 1
                    else:
                        failed.append(item)
                except Exception:
                    failed.append(item)

        self.results['url_verification'] = {
            'total_checked': len(urls_to_check),
            'accessible': accessible,
            'failed': len(failed),
            'success_rate': round(accessible / len(urls_to_check) * 100, 2),
            'failed_urls': failed[:10]  # First 10 failures
        }

        print(f"  Checked:    {len(urls_to_check)}")
        print(f"  Accessible: {accessible}")
        print(f"  Failed:     {len(failed)}")
        print(f"  Success:    {self.results['url_verification']['success_rate']}%")

        return self.results['url_verification']

    def _generate_summary(self):
        """Generate overall summary."""
        summary = {
            'overall_status': 'COMPLETE',
            'issues': []
        }

        # Check each category
        checks = [
            ('product_images', 'Product Images'),
            ('collection_images', 'Collection Images'),
            ('article_featured', 'Article Featured Images'),
            ('article_body', 'Article Body Images'),
            ('metafields', 'Metafield Files'),
        ]

        for key, name in checks:
            data = self.results.get(key, {})

            if key == 'article_body':
                remaining = data.get('articles_with_shopify_urls', 0)
            else:
                remaining = data.get('remaining', 0) or data.get('remaining_with_shopify', 0)

            if remaining > 0:
                summary['overall_status'] = 'INCOMPLETE'
                summary['issues'].append({
                    'category': name,
                    'remaining': remaining
                })

        # Check URL verification
        if 'url_verification' in self.results:
            failed = self.results['url_verification'].get('failed', 0)
            if failed > 0:
                summary['issues'].append({
                    'category': 'URL Accessibility',
                    'failed_urls': failed
                })

        self.results['summary'] = summary

    def _print_results(self):
        """Print final results."""
        print("\n" + "=" * 60)
        print("AUDIT SUMMARY")
        print("=" * 60)

        summary = self.results.get('summary', {})

        status = summary.get('overall_status', 'UNKNOWN')
        status_color = '\033[92m' if status == 'COMPLETE' else '\033[93m'
        reset_color = '\033[0m'

        print(f"\nOverall Status: {status_color}{status}{reset_color}")

        if summary.get('issues'):
            print("\nIssues Found:")
            for issue in summary['issues']:
                print(f"  - {issue['category']}: ", end='')
                if 'remaining' in issue:
                    print(f"{issue['remaining']} items remaining")
                elif 'failed_urls' in issue:
                    print(f"{issue['failed_urls']} URLs not accessible")
        else:
            print("\nNo issues found - migration appears complete!")

        print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Audit media migration completeness',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python audit_media_migration.py              # Full audit
  python audit_media_migration.py --report     # Generate JSON report
  python audit_media_migration.py --verify     # Verify URL accessibility
  python audit_media_migration.py --sample 50  # Verify 50 sample URLs
        """
    )
    parser.add_argument(
        '--report',
        type=str,
        metavar='FILE',
        help='Save audit report to JSON file'
    )
    parser.add_argument(
        '--verify',
        action='store_true',
        help='Verify Supabase URLs are accessible'
    )
    parser.add_argument(
        '--sample',
        type=int,
        default=50,
        help='Number of URLs to sample for verification (default: 50)'
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
        auditor = MediaMigrationAuditor()
        results = auditor.run_full_audit(
            verify_urls=args.verify,
            sample_size=args.sample
        )

        if args.report:
            report_path = Path(args.report)
            with open(report_path, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\nReport saved to: {report_path}")

    except KeyboardInterrupt:
        print("\n\nAudit interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Audit failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
