#!/usr/bin/env python3
"""
HTML Parser Utility Module

Provides functionality for:
- Extracting image URLs from HTML content
- Filtering for Shopify CDN URLs
- Replacing URLs in HTML content
- Generating URL hashes for deduplication
"""

import re
import hashlib
import logging
from typing import List, Dict, Set, Tuple
from urllib.parse import urlparse, urljoin

logger = logging.getLogger(__name__)


# Patterns for Shopify CDN URLs
SHOPIFY_CDN_PATTERNS = [
    r'https?://cdn\.shopify\.com/[^\s"\'\<\>]+',
    r'https?://[^\s"\'\<\>]*\.shopifycdn\.com/[^\s"\'\<\>]+',
    r'https?://cdn\.shopifycdn\.net/[^\s"\'\<\>]+',
]

# Compiled patterns for efficiency
COMPILED_CDN_PATTERNS = [re.compile(pattern, re.IGNORECASE) for pattern in SHOPIFY_CDN_PATTERNS]

# Pattern to match img tags
IMG_TAG_PATTERN = re.compile(
    r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>',
    re.IGNORECASE | re.DOTALL
)

# Pattern for srcset attribute
SRCSET_PATTERN = re.compile(
    r'srcset=["\']([^"\']+)["\']',
    re.IGNORECASE
)

# Pattern for data-src (lazy loading)
DATA_SRC_PATTERN = re.compile(
    r'data-src=["\']([^"\']+)["\']',
    re.IGNORECASE
)

# Pattern for background-image in style
BACKGROUND_IMAGE_PATTERN = re.compile(
    r'background(?:-image)?:\s*url\(["\']?([^"\'\)]+)["\']?\)',
    re.IGNORECASE
)


class HTMLImageExtractor:
    """Extracts and processes image URLs from HTML content."""

    def __init__(self):
        self.shopify_patterns = COMPILED_CDN_PATTERNS

    def extract_all_image_urls(self, html: str) -> Set[str]:
        """
        Extract all image URLs from HTML content.

        Args:
            html: HTML string to parse

        Returns:
            Set of unique image URLs found
        """
        if not html:
            return set()

        urls = set()

        # Extract from <img src="...">
        for match in IMG_TAG_PATTERN.finditer(html):
            url = match.group(1).strip()
            if url and self._is_valid_image_url(url):
                urls.add(url)

        # Extract from srcset attribute
        for match in SRCSET_PATTERN.finditer(html):
            srcset = match.group(1)
            for part in srcset.split(','):
                url = part.strip().split(' ')[0]
                if url and self._is_valid_image_url(url):
                    urls.add(url)

        # Extract from data-src (lazy loading)
        for match in DATA_SRC_PATTERN.finditer(html):
            url = match.group(1).strip()
            if url and self._is_valid_image_url(url):
                urls.add(url)

        # Extract from background-image CSS
        for match in BACKGROUND_IMAGE_PATTERN.finditer(html):
            url = match.group(1).strip()
            if url and self._is_valid_image_url(url):
                urls.add(url)

        return urls

    def extract_shopify_cdn_urls(self, html: str) -> Set[str]:
        """
        Extract only Shopify CDN image URLs from HTML.

        Args:
            html: HTML string to parse

        Returns:
            Set of unique Shopify CDN URLs
        """
        if not html:
            return set()

        urls = set()

        # Use regex to find all Shopify CDN URLs
        for pattern in self.shopify_patterns:
            for match in pattern.finditer(html):
                url = match.group(0)
                # Clean up URL - remove trailing punctuation
                url = self._clean_url(url)
                if url:
                    urls.add(url)

        return urls

    def _is_valid_image_url(self, url: str) -> bool:
        """Check if URL looks like a valid image URL."""
        if not url or url.startswith('data:'):
            return False

        # Must have a valid scheme or be relative
        if url.startswith('//'):
            return True
        if url.startswith('http://') or url.startswith('https://'):
            return True
        if url.startswith('/'):
            return True

        return False

    def _clean_url(self, url: str) -> str:
        """Clean up URL by removing trailing punctuation."""
        if not url:
            return url

        # Remove common trailing characters that might be captured
        while url and url[-1] in '.,;:!?)"\'>':
            url = url[:-1]

        return url

    def is_shopify_cdn_url(self, url: str) -> bool:
        """Check if URL is from Shopify CDN."""
        if not url:
            return False

        for pattern in self.shopify_patterns:
            if pattern.match(url):
                return True

        # Simple string check as fallback
        shopify_domains = ['cdn.shopify.com', '.shopifycdn.com', 'cdn.shopifycdn.net']
        return any(domain in url.lower() for domain in shopify_domains)


class HTMLImageReplacer:
    """Replaces image URLs in HTML content."""

    def __init__(self):
        pass

    def replace_urls(self, html: str, url_map: Dict[str, str]) -> str:
        """
        Replace old URLs with new URLs in HTML content.

        Args:
            html: Original HTML string
            url_map: Dictionary mapping old URLs to new URLs

        Returns:
            HTML with replaced URLs
        """
        if not html or not url_map:
            return html

        result = html

        # Sort by URL length (longest first) to avoid partial replacements
        sorted_urls = sorted(url_map.keys(), key=len, reverse=True)

        for old_url in sorted_urls:
            new_url = url_map[old_url]
            if old_url and new_url:
                result = result.replace(old_url, new_url)

        return result

    def count_shopify_cdn_urls(self, html: str) -> int:
        """Count remaining Shopify CDN URLs in HTML."""
        if not html:
            return 0

        count = 0
        for pattern in COMPILED_CDN_PATTERNS:
            count += len(pattern.findall(html))

        return count


def get_url_hash(url: str, length: int = 12) -> str:
    """
    Generate a deterministic hash from URL for deduplication.

    Args:
        url: URL to hash
        length: Length of hash to return (default 12)

    Returns:
        Hexadecimal hash string
    """
    return hashlib.md5(url.encode()).hexdigest()[:length]


def extract_filename_from_url(url: str) -> Tuple[str, str]:
    """
    Extract filename and extension from URL.

    Args:
        url: URL to parse

    Returns:
        Tuple of (filename_without_ext, extension)
    """
    parsed = urlparse(url)
    path = parsed.path

    # Remove query params if in filename
    if '?' in path:
        path = path.split('?')[0]

    # Get filename
    filename = path.split('/')[-1]

    # Split name and extension
    if '.' in filename:
        parts = filename.rsplit('.', 1)
        return parts[0], f'.{parts[1].lower()}'

    return filename, ''


def analyze_html_images(html: str) -> Dict[str, any]:
    """
    Analyze HTML content for image references.

    Args:
        html: HTML content to analyze

    Returns:
        Dictionary with analysis results
    """
    extractor = HTMLImageExtractor()

    all_urls = extractor.extract_all_image_urls(html)
    shopify_urls = extractor.extract_shopify_cdn_urls(html)

    # Categorize by domain
    domains = {}
    for url in all_urls:
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or 'relative'
            domains[domain] = domains.get(domain, 0) + 1
        except Exception:
            domains['invalid'] = domains.get('invalid', 0) + 1

    return {
        'total_images': len(all_urls),
        'shopify_cdn_images': len(shopify_urls),
        'all_urls': list(all_urls),
        'shopify_urls': list(shopify_urls),
        'domains': domains,
    }
