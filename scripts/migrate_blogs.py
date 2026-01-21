#!/usr/bin/env python3
"""
Blog Migration Script
Migrates blogs and articles from Shopify to Supabase using REST API.
"""

import os
import sys
import json
import logging
import requests
from dotenv import load_dotenv
from datetime import datetime
from time import sleep
from tqdm import tqdm

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('blog_migration.log')
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
SHOPIFY_BASE_URL = f"https://{STORE_NAME}.myshopify.com/admin/api/{API_VERSION}"

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Request configuration
SHOPIFY_HEADERS = {
    'X-Shopify-Access-Token': ACCESS_TOKEN,
    'Content-Type': 'application/json'
}

SUPABASE_HEADERS = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

BATCH_SIZE = int(os.getenv('BATCH_SIZE', '250'))
RETRY_LIMIT = 5
RETRY_WAIT = 2

# ============================================================
# SHOPIFY API HELPERS
# ============================================================

def shopify_request(endpoint, params=None):
    """Make a GET request to Shopify API with retry logic."""
    url = f"{SHOPIFY_BASE_URL}/{endpoint}"
    retries = 0
    wait_time = RETRY_WAIT

    while retries < RETRY_LIMIT:
        try:
            response = requests.get(url, headers=SHOPIFY_HEADERS, params=params)

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
            if retries < RETRY_LIMIT:
                sleep(wait_time)
                wait_time *= 1.5
            else:
                raise

    return None, None

def get_next_page_info(headers):
    """Extract next page info from Link header."""
    link = headers.get('Link', '')
    if 'rel="next"' in link:
        import re
        match = re.search(r'page_info=([^>]+)>; rel="next"', link)
        if match:
            return match.group(1)
    return None

def fetch_all(endpoint, key, params=None):
    """Fetch all records with pagination."""
    all_records = []
    params = params or {}
    params['limit'] = BATCH_SIZE

    while True:
        data, headers = shopify_request(endpoint, params)
        if not data or key not in data:
            break

        records = data[key]
        all_records.extend(records)
        logger.info(f"Fetched {len(all_records)} {key}...")

        next_page = get_next_page_info(headers)
        if not next_page:
            break

        # For next page, only use page_info
        params = {'limit': BATCH_SIZE, 'page_info': next_page}

    return all_records

# ============================================================
# SUPABASE REST API HELPERS
# ============================================================

def supabase_upsert(table, records, on_conflict='id'):
    """Upsert records to Supabase via REST API."""
    if not records:
        return True

    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        **SUPABASE_HEADERS,
        'Prefer': f'resolution=merge-duplicates'
    }

    response = requests.post(url, headers=headers, json=records)

    if response.status_code in [200, 201, 204]:
        return True
    else:
        logger.error(f"Supabase upsert failed: {response.status_code} - {response.text}")
        return False

# ============================================================
# BLOG MIGRATION FUNCTIONS
# ============================================================

def migrate_blogs():
    """Migrate all blogs from Shopify."""
    logger.info("Migrating blogs...")

    data, _ = shopify_request("blogs.json")
    if not data or 'blogs' not in data:
        logger.warning("No blogs found in Shopify")
        return 0, []

    blogs = data['blogs']
    blog_ids = []
    records = []

    for blog in tqdm(blogs, desc="Preparing blogs"):
        record = {
            'id': blog['id'],
            'title': blog.get('title'),
            'handle': blog.get('handle'),
            'commentable': blog.get('commentable', 'no'),
            'feedburner': blog.get('feedburner'),
            'feedburner_location': blog.get('feedburner_location'),
            'tags': blog.get('tags'),
            'template_suffix': blog.get('template_suffix'),
            'created_at': blog.get('created_at'),
            'updated_at': blog.get('updated_at')
        }
        records.append(record)
        blog_ids.append(blog['id'])

    if supabase_upsert('blogs', records):
        logger.info(f"Migrated {len(records)} blogs")
    else:
        logger.error("Failed to migrate blogs")
        return 0, []

    return len(records), blog_ids

def migrate_articles(blog_ids):
    """Migrate all articles from all blogs."""
    logger.info("Migrating articles...")

    if not blog_ids:
        logger.warning("No blog IDs provided")
        return 0

    total_count = 0

    for blog_id in blog_ids:
        logger.info(f"Fetching articles for blog {blog_id}...")

        # Fetch articles for this blog
        articles = fetch_all(f"blogs/{blog_id}/articles.json", "articles")
        records = []

        for article in tqdm(articles, desc=f"Blog {blog_id} articles"):
            image = article.get('image') or {}

            record = {
                'id': article['id'],
                'blog_id': blog_id,
                'title': article.get('title'),
                'handle': article.get('handle'),
                'author': article.get('author'),
                'body_html': article.get('body_html'),
                'summary_html': article.get('summary_html'),
                'tags': article.get('tags'),
                'image_src': image.get('src'),
                'image_alt': image.get('alt'),
                'image_width': image.get('width'),
                'image_height': image.get('height'),
                'published': article.get('published_at') is not None,
                'published_at': article.get('published_at'),
                'template_suffix': article.get('template_suffix'),
                'user_id': article.get('user_id'),
                'created_at': article.get('created_at'),
                'updated_at': article.get('updated_at')
            }
            records.append(record)

        if records:
            if supabase_upsert('articles', records):
                total_count += len(records)
                logger.info(f"Migrated {len(records)} articles from blog {blog_id}")
            else:
                logger.error(f"Failed to migrate articles from blog {blog_id}")

    logger.info(f"Migrated {total_count} articles total")
    return total_count

def run_blog_migration():
    """Run the complete blog migration."""
    logger.info("=" * 60)
    logger.info("BLOG MIGRATION: Shopify -> Supabase (REST API)")
    logger.info("=" * 60)

    # Validate environment
    if not STORE_NAME:
        logger.error("Missing SHOPIFY_STORE_NAME environment variable")
        sys.exit(1)
    if not ACCESS_TOKEN:
        logger.error("Missing SHOPIFY_ADMIN_API_ACCESS_TOKEN environment variable")
        sys.exit(1)
    if not SUPABASE_URL:
        logger.error("Missing SUPABASE_URL environment variable")
        sys.exit(1)
    if not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
        sys.exit(1)

    logger.info(f"Store: {STORE_NAME}")
    logger.info(f"API Version: {API_VERSION}")
    logger.info(f"Supabase URL: {SUPABASE_URL}")

    try:
        # Migrate blogs first
        blog_count, blog_ids = migrate_blogs()

        # Then migrate articles for each blog
        article_count = migrate_articles(blog_ids)

        logger.info("=" * 60)
        logger.info("BLOG MIGRATION COMPLETE")
        logger.info(f"  Blogs migrated: {blog_count}")
        logger.info(f"  Articles migrated: {article_count}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    run_blog_migration()
