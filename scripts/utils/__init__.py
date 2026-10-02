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
    resolve_supabase_url,
    resolve_supabase_secret_key,
    resolve_r2_access_key_id,
    resolve_r2_bucket,
    resolve_r2_endpoint,
    resolve_r2_public_base_url,
    resolve_r2_secret_access_key,
    get_artist_keywords,
)
from .retry import retry_with_backoff
from .cli import create_parser, resolve_execute, configure_logging, upsert_batch_size
from .logging_config import setup_logging
from .r2_helpers import (
    MAX_VARIANT_WIDTH,
    R2NotConfiguredError,
    delete_image,
    is_r2_url,
    public_url_for,
    to_webp_variant,
    upload_image,
)
from .image_processor import (
    ImageProcessor,
    BackupManager,
    R2Uploader,
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
    'resolve_supabase_url',
    'resolve_supabase_secret_key',
    'resolve_r2_access_key_id',
    'resolve_r2_bucket',
    'resolve_r2_endpoint',
    'resolve_r2_public_base_url',
    'resolve_r2_secret_access_key',
    'get_artist_keywords',
    # Retry + CLI
    'retry_with_backoff',
    'create_parser',
    'resolve_execute',
    'configure_logging',
    'upsert_batch_size',
    # Logging
    'setup_logging',
    # Object storage (Cloudflare R2)
    'MAX_VARIANT_WIDTH',
    'R2NotConfiguredError',
    'delete_image',
    'is_r2_url',
    'public_url_for',
    'to_webp_variant',
    'upload_image',
    # Image Processing
    'ImageProcessor',
    'BackupManager',
    'R2Uploader',
    'is_shopify_cdn_url',
    'is_supabase_url',
    'get_url_hash',
    # HTML Parsing
    'HTMLImageExtractor',
    'HTMLImageReplacer',
    'analyze_html_images',
]
