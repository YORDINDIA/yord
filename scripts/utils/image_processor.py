#!/usr/bin/env python3
"""
Image Processor Utility Module

Provides shared image processing functionality:
- Download images from URLs with retry logic
- Convert images to WebP format
- Compress images to target size
- Create local backups
"""

import io
import os
import time
import hashlib
import logging
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from urllib.parse import urlparse, unquote

import requests
from PIL import Image

logger = logging.getLogger(__name__)

# Optimization settings
TARGET_SIZE_KB = 500
MIN_QUALITY = 60
MAX_QUALITY = 95
DEFAULT_QUALITY = 90

# HTTP settings
REQUEST_TIMEOUT = 30
RETRY_ATTEMPTS = 3
RETRY_DELAY = 2


class ImageProcessor:
    """Handles image download, compression, and WebP conversion."""

    def __init__(self, target_size_kb: int = TARGET_SIZE_KB):
        self.target_size_kb = target_size_kb

    def download_image(
        self,
        url: str,
        max_retries: int = RETRY_ATTEMPTS
    ) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
        """
        Download image from URL with retry logic.

        Args:
            url: The URL to download from
            max_retries: Maximum number of retry attempts

        Returns:
            Tuple of (image_bytes, content_type, error_message)
        """
        last_error = None

        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=REQUEST_TIMEOUT, stream=True)
                response.raise_for_status()

                content_type = response.headers.get('content-type', 'image/jpeg')
                image_data = response.content

                return image_data, content_type, None

            except requests.exceptions.RequestException as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    wait_time = RETRY_DELAY * (2 ** attempt)
                    logger.warning(f"Download failed (attempt {attempt + 1}): {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)

        return None, None, last_error

    def convert_to_webp(
        self,
        image_data: bytes,
        quality: int = DEFAULT_QUALITY,
        compress_to_target: bool = True
    ) -> Tuple[bytes, int]:
        """
        Convert image to WebP format with optional compression.

        Args:
            image_data: Raw image bytes
            quality: Initial quality setting (60-95)
            compress_to_target: If True, compress to target size

        Returns:
            Tuple of (webp_bytes, final_quality)
        """
        image = Image.open(io.BytesIO(image_data))

        # Ensure RGBA mode for transparency support
        if image.mode not in ('RGBA', 'RGB'):
            image = image.convert('RGBA')

        original_size = len(image_data)

        # If already small enough and not compressing, just convert
        if not compress_to_target or original_size <= self.target_size_kb * 1024:
            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=quality, method=6)
            return buffer.getvalue(), quality

        # Binary search for optimal quality
        return self._compress_to_target_size(image)

    def _compress_to_target_size(
        self,
        image: Image.Image
    ) -> Tuple[bytes, int]:
        """
        Binary search for optimal quality to achieve target size.

        Args:
            image: PIL Image object

        Returns:
            Tuple of (compressed_bytes, final_quality)
        """
        low, high = MIN_QUALITY, MAX_QUALITY
        best_result = None
        best_quality = MAX_QUALITY

        while low <= high:
            mid = (low + high) // 2

            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=mid, method=6)
            size_kb = len(buffer.getvalue()) / 1024

            if size_kb <= self.target_size_kb:
                best_result = buffer.getvalue()
                best_quality = mid
                low = mid + 1  # Try higher quality
            else:
                high = mid - 1  # Need lower quality

        # If still over target at min_quality, use that result
        if best_result is None:
            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=MIN_QUALITY, method=6)
            return buffer.getvalue(), MIN_QUALITY

        return best_result, best_quality

    def get_extension_from_url(self, url: str) -> str:
        """Extract file extension from URL."""
        parsed = urlparse(url)
        path = unquote(parsed.path)
        filename = os.path.basename(path)

        # Remove query params if present
        if '?' in filename:
            filename = filename.split('?')[0]

        _, ext = os.path.splitext(filename)
        return ext.lower() if ext else '.jpg'

    def get_content_type(self, extension: str) -> str:
        """Get MIME type from extension."""
        content_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.heic': 'image/heic',
            '.svg': 'image/svg+xml',
        }
        return content_types.get(extension.lower(), 'image/jpeg')

    def get_image_dimensions(self, image_data: bytes) -> Tuple[int, int]:
        """Get image width and height."""
        try:
            image = Image.open(io.BytesIO(image_data))
            return image.size  # (width, height)
        except Exception:
            return (0, 0)


class BackupManager:
    """Manages local file backups."""

    def __init__(self, backup_dir: str = 'backups/media'):
        self.backup_dir = Path(backup_dir)

    def create_backup(
        self,
        data: bytes,
        category: str,
        entity_id: str,
        filename: str
    ) -> Optional[Path]:
        """
        Create a local backup of media file.

        Args:
            data: File bytes to save
            category: Category folder (e.g., 'articles', 'metafields')
            entity_id: Entity identifier (e.g., article_id)
            filename: Filename with extension

        Returns:
            Path to the saved file, or None on error
        """
        try:
            backup_path = self.backup_dir / category / str(entity_id)
            backup_path.mkdir(parents=True, exist_ok=True)

            file_path = backup_path / filename
            with open(file_path, 'wb') as f:
                f.write(data)

            logger.debug(f"Backup created: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            return None

    def create_content_backup(
        self,
        data: bytes,
        category: str,
        entity_id: str,
        url_hash: str,
        extension: str
    ) -> Optional[Path]:
        """
        Create backup for content-embedded images (like body_html images).

        Args:
            data: File bytes
            category: Category folder
            entity_id: Entity identifier
            url_hash: Hash of original URL for deduplication
            extension: File extension

        Returns:
            Path to saved file
        """
        return self.create_backup(
            data,
            f"{category}/{entity_id}/content",
            "",
            f"{url_hash}{extension}"
        )


class StorageUploader:
    """Handles Supabase storage operations."""

    def __init__(self, supabase_client, bucket: str = 'products'):
        self.supabase = supabase_client
        self.bucket = bucket

    def upload_image(
        self,
        path: str,
        data: bytes,
        content_type: str = 'image/webp',
        max_retries: int = RETRY_ATTEMPTS
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Upload image to Supabase Storage with retry logic.

        Args:
            path: Storage path (e.g., 'articles/123.webp')
            data: Image bytes
            content_type: MIME type
            max_retries: Number of retry attempts

        Returns:
            Tuple of (public_url, error_message)
        """
        last_error = None

        for attempt in range(max_retries):
            try:
                self.supabase.storage.from_(self.bucket).upload(
                    path,
                    data,
                    file_options={
                        'content-type': content_type,
                        'upsert': 'true'
                    }
                )
                public_url = self.supabase.storage.from_(self.bucket).get_public_url(path)
                return public_url, None

            except Exception as e:
                last_error = str(e)
                if attempt < max_retries - 1:
                    wait_time = RETRY_DELAY * (2 ** attempt)
                    logger.warning(f"Upload failed (attempt {attempt + 1}): {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)

        return None, last_error

    def delete_image(self, path: str) -> bool:
        """Delete image from storage."""
        try:
            self.supabase.storage.from_(self.bucket).remove([path])
            return True
        except Exception as e:
            logger.error(f"Failed to delete {path}: {e}")
            return False

    def image_exists(self, path: str) -> bool:
        """Check if image exists in storage."""
        try:
            # Try to get metadata
            self.supabase.storage.from_(self.bucket).download(path)
            return True
        except Exception:
            return False


def get_url_hash(url: str) -> str:
    """Generate a short hash from URL for deduplication."""
    return hashlib.md5(url.encode()).hexdigest()[:12]


def is_shopify_cdn_url(url: str) -> bool:
    """Check if URL is from Shopify CDN."""
    if not url:
        return False

    shopify_patterns = [
        'cdn.shopify.com',
        '.shopifycdn.com',
        'cdn.shopifycdn.net',
    ]

    return any(pattern in url.lower() for pattern in shopify_patterns)


def is_supabase_url(url: str) -> bool:
    """Check if URL is from Supabase storage."""
    if not url:
        return False

    return 'supabase.co/storage' in url.lower()
