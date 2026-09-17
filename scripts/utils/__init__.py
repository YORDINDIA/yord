"""Shared utilities for YORD migration scripts."""

from .shopify import ShopifyClient, shopify_request, get_all_paginated
from .supabase_helpers import (
    get_supabase_client,
    get_supabase_count,
    batch_upsert,
    ProductRecord,
    VariantRecord,
)
from .config import (
    ARTIST_COLLECTIONS,
    HOMEPAGE_ARTISTS,
    BATCH_SIZE,
    SUPABASE_UPSERT_BATCH_SIZE,
    RETRY_LIMIT,
    RETRY_WAIT,
    get_project_ref,
    get_shopify_store_name,
    get_artist_keywords,
)
from .retry import retry_with_backoff
from .cli import create_parser, resolve_execute, configure_logging, upsert_batch_size
from .logging_config import setup_logging
from .image_processor import (
    ImageProcessor,
    BackupManager,
    StorageUploader,
    is_shopify_cdn_url,
    is_supabase_url,
    get_url_hash,
)
from .html_parser import (
    HTMLImageExtractor,
    HTMLImageReplacer,
    analyze_html_images,
)

__all__ = [
    # Shopify
    'ShopifyClient',
    'shopify_request',
    'get_all_paginated',
    # Supabase
    'get_supabase_client',
    'get_supabase_count',
    'batch_upsert',
    'ProductRecord',
    'VariantRecord',
    # Config
    'ARTIST_COLLECTIONS',
    'HOMEPAGE_ARTISTS',
    'BATCH_SIZE',
    'SUPABASE_UPSERT_BATCH_SIZE',
    'RETRY_LIMIT',
    'RETRY_WAIT',
    'get_project_ref',
    'get_shopify_store_name',
    'get_artist_keywords',
    # Retry + CLI
    'retry_with_backoff',
    'create_parser',
    'resolve_execute',
    'configure_logging',
    'upsert_batch_size',
    # Logging
    'setup_logging',
    # Image Processing
    'ImageProcessor',
    'BackupManager',
    'StorageUploader',
    'is_shopify_cdn_url',
    'is_supabase_url',
    'get_url_hash',
    # HTML Parsing
    'HTMLImageExtractor',
    'HTMLImageReplacer',
    'analyze_html_images',
]
