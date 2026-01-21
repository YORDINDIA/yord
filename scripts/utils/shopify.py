"""Shopify API client with retry logic and pagination support."""

import os
import logging
import requests
from time import sleep
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_BATCH_SIZE = 250
DEFAULT_RETRY_LIMIT = 5
DEFAULT_RETRY_WAIT = 2


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
        self.store_name = store_name or os.getenv('SHOPIFY_STORE_NAME')
        self.access_token = access_token or os.getenv('SHOPIFY_ADMIN_API_ACCESS_TOKEN')
        self.api_version = api_version or os.getenv('SHOPIFY_API_VERSION', '2025-01')
        self.batch_size = batch_size or int(os.getenv('BATCH_SIZE', str(DEFAULT_BATCH_SIZE)))
        self.retry_limit = retry_limit or DEFAULT_RETRY_LIMIT
        self.retry_wait = retry_wait or DEFAULT_RETRY_WAIT

        self.base_url = f"https://{self.store_name}.myshopify.com/admin/api/{self.api_version}"
        self.headers = {
            'X-Shopify-Access-Token': self.access_token,
            'Content-Type': 'application/json'
        }

    def request(self, endpoint: str, params: dict = None) -> tuple:
        """Make a GET request to Shopify API with retry logic.

        Returns:
            tuple: (data, headers) or (None, None) on failure
        """
        url = f"{self.base_url}/{endpoint}"
        retries = 0
        wait_time = self.retry_wait

        while retries < self.retry_limit:
            try:
                response = requests.get(url, headers=self.headers, params=params)

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
                sleep(wait_time * retries)

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
