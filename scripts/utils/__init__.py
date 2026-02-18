"""Shared utilities for YORD migration scripts."""

from .shopify import ShopifyClient, shopify_request, get_all_paginated
from .supabase_helpers import get_supabase_client, get_supabase_count, batch_upsert
from .config import (
    ARTIST_COLLECTIONS,
    HOMEPAGE_ARTISTS,
    get_project_ref,
    get_artist_keywords,
)
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
    # Config
    'ARTIST_COLLECTIONS',
    'HOMEPAGE_ARTISTS',
    'get_project_ref',
    'get_artist_keywords',
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
