#!/usr/bin/env python3
"""Cloudflare R2 helpers for the migration scripts.

Wraps the S3-compatible R2 API so every upload path (product images, article
media, metafields, blog images) shares one client, one retry policy, one URL
shape and one variant policy. Credentials come from ``R2_ACCOUNT_ID`` /
``R2_ACCESS_KEY_ID`` / ``R2_SECRET_ACCESS_KEY`` / ``R2_BUCKET`` (see the root
``.env.example``); the endpoint is derived from the account id unless
``R2_ENDPOINT`` or ``R2_JURISDICTION`` overrides it.

Delivery is plain object reads through ``R2_PUBLIC_BASE_URL`` (the bucket's
r2.dev URL today, a custom domain later). R2 does not transform images, so
every image is uploaded as a single web-optimized variant: WebP, at most
``MAX_VARIANT_WIDTH`` wide (see ``to_webp_variant``). Animated GIFs, SVGs and
HEIC files are uploaded untouched — re-encoding them would lose animation or
vector data.

Object keys keep the public-id conventions the database and docs use:
``products/<handle>/01.webp``, ``blog/<handle>.webp``,
``blog-placeholders/<category>.webp``, ``metafields/<owner>/<id>/<name>.webp``.
"""

from __future__ import annotations

import io
import logging
import threading
import time
from typing import Optional, Tuple
from urllib.parse import quote, unquote, urlparse

import boto3
from botocore.config import Config as BotoConfig
from PIL import Image

from .config import (
    resolve_r2_access_key_id,
    resolve_r2_bucket,
    resolve_r2_endpoint,
    resolve_r2_public_base_url,
    resolve_r2_secret_access_key,
)

logger = logging.getLogger(__name__)

RETRY_ATTEMPTS = 3
RETRY_DELAY = 2

# One web-optimized variant per image: big enough for a full-bleed hero on a
# 2x laptop screen, small enough that mobile is not punished for it.
MAX_VARIANT_WIDTH = 1600
VARIANT_QUALITY = 80
VARIANT_MIME = 'image/webp'
VARIANT_EXTENSION = '.webp'

# Variant cache: derivatives are immutable, so a year-long TTL is safe.
CACHE_CONTROL = 'public, max-age=31536000, immutable'

# Formats we re-encode to a WebP variant. GIF/SVG/HEIC are deliberately absent:
# WebP cannot carry SVG, and a static WebP would silently drop GIF animation.
TRANSCODE_MIMES = frozenset({'image/jpeg', 'image/jpg', 'image/png', 'image/webp'})

# Stored extension for formats we upload as-is.
EXTENSION_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/heic': '.heic',
    'application/pdf': '.pdf',
}

_thread_local = threading.local()


class R2NotConfiguredError(ValueError):
    """Raised when an upload is attempted without R2 credentials."""


def configure_r2():
    """Return an S3 client for R2, creating one per thread on first use.

    Raises:
        R2NotConfiguredError: when any required variable is missing. Fail fast
            rather than uploading into the wrong bucket on a silent default.
    """
    client = getattr(_thread_local, 'client', None)
    if client is not None:
        return client

    missing = [
        name
        for name, value in (
            ('R2_ACCOUNT_ID (or R2_ENDPOINT)', resolve_r2_endpoint()),
            ('R2_ACCESS_KEY_ID', resolve_r2_access_key_id()),
            ('R2_SECRET_ACCESS_KEY', resolve_r2_secret_access_key()),
            ('R2_BUCKET', resolve_r2_bucket()),
        )
        if not value
    ]
    if missing:
        raise R2NotConfiguredError(
            "Missing Cloudflare R2 credentials: set "
            + ", ".join(missing)
            + " in .env (see root .env.example; R2 → Manage API tokens)"
        )

    client = boto3.client(
        's3',
        endpoint_url=resolve_r2_endpoint(),
        aws_access_key_id=resolve_r2_access_key_id(),
        aws_secret_access_key=resolve_r2_secret_access_key(),
        region_name='auto',
        config=BotoConfig(
            signature_version='s3v4',
            retries={'max_attempts': RETRY_ATTEMPTS, 'mode': 'standard'},
        ),
    )
    _thread_local.client = client
    return client


def public_url_for(key: str) -> str:
    """Build the public delivery URL for an object key.

    Returns ``""`` when ``R2_PUBLIC_BASE_URL`` is unset — callers that store
    URLs must see that as an error rather than a URL they should trust, so
    ``upload_image`` refuses to upload without it (and URL-parsing helpers
    simply find nothing to match).
    """
    base = resolve_r2_public_base_url()
    if not base:
        return ""
    return f"{base}/{quote(key.lstrip('/'))}"


def _with_extension(key: str, extension: str) -> str:
    """Replace a key's trailing extension, if any, and normalise ``key``."""
    key = key.lstrip('/')
    if not extension:
        return key
    stem, _, current = key.rpartition('.')
    # Only treat the tail as an extension when it is short and has no slash.
    if stem and '/' not in current and len(current) <= 5:
        return f"{stem}{extension}"
    return f"{key}{extension}"


def to_webp_variant(
    data: bytes,
    max_width: int = MAX_VARIANT_WIDTH,
    quality: int = VARIANT_QUALITY,
) -> Optional[bytes]:
    """Return web-optimized WebP bytes for ``data``, or ``None`` if unreadable.

    Images already at or below ``max_width`` and already WebP are returned
    unchanged, so re-running an optimization never re-compresses (and never
    degrades) an existing variant. Everything else is downscaled with Lanczos
    and re-encoded; Pillow drops EXIF/GPS metadata as a side effect.
    """
    try:
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
            if (image.format or '').upper() == 'WEBP' and width <= max_width:
                return data

            frame_count = getattr(image, 'n_frames', 1)
            if frame_count > 1:
                # Animated source: keep it as-is rather than shipping a frozen
                # first frame.
                return None

            if width > max_width:
                scale = max_width / float(width)
                image = image.resize(
                    (max_width, max(1, round(height * scale))),
                    Image.Resampling.LANCZOS,
                )

            if image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')

            buffer = io.BytesIO()
            image.save(buffer, format='WEBP', quality=quality, method=6)
            return buffer.getvalue()
    except Exception as e:  # unreadable file: let the caller upload as-is
        logger.warning(f"Could not build a WebP variant: {e}")
        return None


def upload_image(
    key: str,
    data: bytes,
    content_type: str = 'image/webp',
    max_retries: int = RETRY_ATTEMPTS,
) -> Tuple[Optional[str], Optional[str]]:
    """Upload media to R2 and return ``(public_url, error)``.

    Images in ``TRANSCODE_MIMES`` are stored as a single WebP variant (at most
    ``MAX_VARIANT_WIDTH`` wide) with the key's extension switched to ``.webp``;
    an unreadable image falls back to a byte-for-byte upload. Other formats —
    GIF, SVG, HEIC, PDFs from metafields — keep their own extension and content
    type.

    Args:
        key: object key, e.g. ``products/<handle>/01`` (extension optional;
            replaced by the stored format).
        data: file bytes.
        content_type: MIME type of ``data``.
        max_retries: attempts before giving up, with exponential backoff.
    """
    client = configure_r2()
    bucket = resolve_r2_bucket()

    if not resolve_r2_public_base_url():
        # Without the delivery base URL the PUT would succeed and then return
        # "" as the object's URL — a silent empty `storage_url` in the database
        # (and an empty value in the upload checkpoint). Fail before the write.
        return None, (
            "R2_PUBLIC_BASE_URL is not set: enable the bucket's public "
            "development URL (or connect a custom domain) and set it in .env. "
            "Refusing to upload because the URL it would return is empty."
        )

    is_image = content_type.startswith('image/')
    if is_image and content_type in TRANSCODE_MIMES:
        variant = to_webp_variant(data)
        if variant is not None:
            data = variant
            content_type = VARIANT_MIME
            key = _with_extension(key, VARIANT_EXTENSION)
        else:
            key = _with_extension(key, EXTENSION_BY_MIME.get(content_type, ''))
    elif is_image:
        key = _with_extension(key, EXTENSION_BY_MIME.get(content_type, ''))
    else:
        key = key.lstrip('/')

    last_error: Optional[str] = None
    for attempt in range(max_retries):
        try:
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                CacheControl=CACHE_CONTROL,
            )
            return public_url_for(key), None
        except Exception as e:
            last_error = str(e)
            if attempt < max_retries - 1:
                wait_time = RETRY_DELAY * (2 ** attempt)
                logger.warning(
                    f"R2 upload failed (attempt {attempt + 1}): {e}. "
                    f"Retrying in {wait_time}s..."
                )
                time.sleep(wait_time)

    return None, last_error


def delete_image(key: str) -> bool:
    """Delete an object from R2. Best-effort, like the old bucket delete."""
    try:
        configure_r2().delete_object(Bucket=resolve_r2_bucket(), Key=key.lstrip('/'))
        return True
    except Exception as e:
        logger.error(f"Failed to delete {key}: {e}")
        return False


def is_r2_url(url: str) -> bool:
    """Check if a URL points at the configured R2 public bucket.

    Matches the configured base URL so the check survives the move from the
    r2.dev development URL to a custom domain; falls back to any ``.r2.dev``
    host when the base URL is not set.
    """
    if not url:
        return False
    base = resolve_r2_public_base_url()
    if base:
        return url.startswith(base + '/') or url == base
    lowered = url.lower()
    return '.r2.dev/' in lowered or lowered.endswith('.r2.dev')


def public_url_host() -> str:
    """Host of the configured public delivery URL (``""`` when unset)."""
    base = resolve_r2_public_base_url()
    if not base:
        return ""
    return urlparse(base).netloc


def key_from_public_url(url: str) -> str:
    """Object key inside the configured bucket for a public R2 URL.

    Strips the base URL's own path (empty for r2.dev, possibly a prefix for a
    custom domain) and the leading slash, leaving the key used by
    ``put_object``/``delete_object``.
    """
    path = unquote(urlparse(url).path)
    base_path = unquote(urlparse(resolve_r2_public_base_url()).path).rstrip('/')
    if base_path and path.startswith(base_path):
        path = path[len(base_path):]
    return path.lstrip('/')


def public_url_like_pattern() -> str:
    """PostgREST ``like`` pattern that matches stored R2 URLs.

    Derived from ``R2_PUBLIC_BASE_URL`` so audits keep counting the right rows
    after the switch from the r2.dev development URL to a custom domain. Falls
    back to ``r2.dev`` so an unset variable still recognises stored URLs.
    """
    host = public_url_host() or 'r2.dev'
    return f'%{host}%'

