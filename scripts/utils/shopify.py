"""Shopify API client with retry logic and pagination support."""

import logging
import os

import requests
from dotenv import load_dotenv

from .config import RETRY_LIMIT, RETRY_WAIT, BATCH_SIZE, get_shopify_store_name
from .retry import retry_with_backoff

load_dotenv()

logger = logging.getLogger(__name__)

# Back-compat aliases (canonical values now live in utils.config).
DEFAULT_BATCH_SIZE = BATCH_SIZE
DEFAULT_RETRY_LIMIT = RETRY_LIMIT
DEFAULT_RETRY_WAIT = RETRY_WAIT


class ShopifyClient:
    """Shopify Admin API client with automatic retry and pagination."""

    def __init__(
        self,
        store_name: str = None,
        access_token: str = None,
        api_version: str = None,
        batch_size: int = None,
        retry_limit: int = None,
        retry_wait: int = None,
    ):
        self.store_name = store_name or get_shopify_store_name()
        self.access_token = access_token or os.getenv('SHOPIFY_ADMIN_API_ACCESS_TOKEN')
        self.api_version = api_version or os.getenv('SHOPIFY_API_VERSION', '2025-01')
        self.batch_size = batch_size or BATCH_SIZE
        self.retry_limit = retry_limit or RETRY_LIMIT
        self.retry_wait = retry_wait or RETRY_WAIT

        self.base_url = f"https://{self.store_name}.myshopify.com/admin/api/{self.api_version}"
        self.headers = {
            'X-Shopify-Access-Token': self.access_token,
            'Content-Type': 'application/json'
        }

    def request(self, endpoint: str, params: dict = None) -> tuple:
        """Make a GET request to Shopify API with retry logic.

        Retry/backoff lives in :mod:`utils.retry` (honors ``Retry-After``
        on 429, exponential backoff + jitter).

        Returns:
            tuple: (data, headers) or (None, None) on failure
        """
        url = f"{self.base_url}/{endpoint}"

        def _attempt():
            response = requests.get(url, headers=self.headers, params=params)
            if response.status_code == 200:
                return response.json(), response.headers
            if response.status_code == 429:
                return response  # retry helper waits per Retry-After
            response.raise_for_status()
            return response.json(), response.headers  # pragma: no cover

        try:
            return retry_with_backoff(
                _attempt, retry_limit=self.retry_limit,
                base_wait=self.retry_wait, logger_=logger,
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed after {self.retry_limit} attempts: {e}")
            return None, None

    def get_all_paginated(self, endpoint: str, key: str, params: dict = None) -> list:
        """Fetch all items from a paginated Shopify endpoint.

        Args:
            endpoint: API endpoint (e.g., 'products.json')
            key: Response key containing items (e.g., 'products')
            params: Optional query parameters

        Returns:
            list: All items from all pages
        """
        all_items = []
        if params is None:
            params = {}
        params['limit'] = self.batch_size

        while True:
            data, headers = self.request(endpoint, params)
            if not data or key not in data:
                break

            items = data[key]
            all_items.extend(items)
            logger.info(f"  Fetched {len(all_items)} {key}...")

            # Check for next page
            link_header = headers.get('Link', '') if headers else ''
            if 'rel="next"' not in link_header:
                break

            # Extract next page URL
            for link in link_header.split(','):
                if 'rel="next"' in link:
                    next_url = link.split(';')[0].strip(' <>')
                    # Extract page_info parameter
                    if 'page_info=' in next_url:
                        page_info = next_url.split('page_info=')[1].split('&')[0]
                        params = {'limit': self.batch_size, 'page_info': page_info}
                    break

        return all_items

    def get_count(self, endpoint: str, params: dict = None) -> int:
        """Get count from a Shopify count endpoint.

        Args:
            endpoint: Count endpoint (e.g., 'products/count.json')
            params: Optional query parameters

        Returns:
            int: Count value or 0 on error
        """
        data, _ = self.request(endpoint, params)
        if data and 'count' in data:
            return data['count']
        return 0


# Standalone functions for backwards compatibility
def shopify_request(endpoint: str, params: dict = None) -> tuple:
    """Make a GET request to Shopify API with retry logic.

    Uses environment variables for configuration.
    """
    client = ShopifyClient()
    return client.request(endpoint, params)


def get_all_paginated(endpoint: str, key: str, params: dict = None) -> list:
    """Fetch all items from a paginated Shopify endpoint.

    Uses environment variables for configuration.
    """
    client = ShopifyClient()
    return client.get_all_paginated(endpoint, key, params)
