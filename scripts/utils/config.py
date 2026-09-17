"""Centralized configuration for YORD migration scripts.

Precedence for every setting: **env var > .env file > built-in default**.
(``load_dotenv()`` below loads ``.env`` into ``os.environ`` without
overriding real env vars, so ``os.getenv`` reads implement this order.)

No hardcoded credentials or project refs live here: missing required values
raise ``ValueError`` with an actionable message (fail fast, never migrate
into the wrong project on a silent default).
"""

import os
import warnings
from dotenv import load_dotenv

load_dotenv()

# --- Shared request / batching defaults (single source of truth) ---
# Shopify caps page size at 250; Supabase upserts stay well under payload
# limits at 500 rows per batch.
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "250"))
SUPABASE_UPSERT_BATCH_SIZE = int(os.getenv("SUPABASE_UPSERT_BATCH_SIZE", "500"))
RETRY_LIMIT = int(os.getenv("RETRY_LIMIT", "5"))
RETRY_WAIT = float(os.getenv("RETRY_WAIT", "2"))  # base seconds for backoff


def get_shopify_store_name(explicit: str | None = None) -> str:
    """Resolve the Shopify store subdomain.

    Reads ``SHOPIFY_STORE_NAME`` (canonical, see ``.env.example``), falling
    back to legacy ``SHOPIFY_STORE`` with a deprecation warning. Pass
    ``explicit`` to override both (e.g. from a CLI flag or constructor arg).
    """
    if explicit:
        return explicit
    name = os.getenv("SHOPIFY_STORE_NAME")
    if name:
        return name
    legacy = os.getenv("SHOPIFY_STORE")
    if legacy:
        warnings.warn(
            "SHOPIFY_STORE is deprecated; rename it to SHOPIFY_STORE_NAME in .env",
            DeprecationWarning,
            stacklevel=2,
        )
        # Accept a full "foo.myshopify.com" value or a bare subdomain.
        return legacy.replace(".myshopify.com", "")
    raise ValueError(
        "Missing Shopify store name: set SHOPIFY_STORE_NAME in .env "
        "(e.g. SHOPIFY_STORE_NAME=5217cc-15 for 5217cc-15.myshopify.com)"
    )


def get_project_ref() -> str:
    """Get Supabase project reference from the environment.

    Raises:
        ValueError: If SUPABASE_PROJECT_REF is not set. The previous
            hardcoded fallback risked pointing scripts at the wrong
            project; set the var explicitly instead.
    """
    ref = os.getenv("SUPABASE_PROJECT_REF")
    if not ref:
        raise ValueError(
            "Missing SUPABASE_PROJECT_REF: set it in .env to your Supabase "
            "project ref (the subdomain in https://<ref>.supabase.co)"
        )
    return ref


# Artist collections with keywords for matching products
# Combined from populate_collects.py and fix_artist_collections.py
ARTIST_COLLECTIONS = {
    'alan-walker': {
        'name': 'Alan Walker',
        'keywords': ['alan walker', 'alan-walker', 'alanwalker'],
        'search_terms': ['alan walker'],
    },
    'coldplay': {
        'name': 'Coldplay',
        'keywords': ['coldplay', 'cold play', 'music of the spheres', 'mots tour'],
        'search_terms': ['coldplay', 'cold play', 'music of the spheres'],
    },
    'diljit-dosanjh': {
        'name': 'Diljit Dosanjh',
        'keywords': ['diljit', 'dosanjh', 'dil-luminati', 'dilluminati', 'diljit dosanjh', 'diljitdosanjh'],
        'search_terms': ['diljit dosanjh', 'diljit', 'dosanjh', 'diljitdosanjh', 'dil-luminati'],
    },
    'dua-lipa': {
        'name': 'Dua Lipa',
        'keywords': ['dua lipa', 'dua-lipa', 'dualipa'],
        'search_terms': ['dua lipa'],
    },
    'ed-sheeran': {
        'name': 'Ed Sheeran',
        'keywords': ['ed sheeran', 'ed-sheeran', 'sheeran'],
        'search_terms': ['ed sheeran', 'sheeran'],
    },
    'guns-and-roses': {
        'name': "Guns N' Roses",
        'keywords': ['guns n roses', 'guns and roses', 'guns-n-roses', 'gnr band'],
        'search_terms': ['guns n roses', 'guns and roses'],
    },
    'hanumankind': {
        'name': 'Hanumankind',
        'keywords': ['hanumankind', 'big dawgs'],
        'search_terms': ['hanumankind', 'big dawgs'],
    },
    'honey-singh': {
        'name': 'Yo Yo Honey Singh',
        'keywords': ['honey singh', 'yo yo honey', 'yoyo honey', 'honeysingh'],
        'search_terms': ['honey singh', 'yo yo honey', 'yoyo honey', 'honeysingh'],
    },
    'karan-aujla': {
        'name': 'Karan Aujla',
        # NOTE: bare 'karan' removed -- it over-matched (e.g. "Karan Kundra",
        # "Karakoram" vendor strings). Use the full-name / handle forms below.
        'keywords': ['karan aujla', 'aujla', 'karanaujla'],
        'search_terms': ['karan aujla', 'aujla', 'karanaujla'],
    },
    'krsna': {
        'name': 'KR$NA',
        'keywords': ['krsna', 'kr$na'],
        'search_terms': ['krsna'],
    },
    'lollapalooza-india': {
        'name': 'Lollapalooza India',
        'keywords': ['lollapalooza', 'lolla india'],
        'search_terms': ['lollapalooza', 'lolla india'],
    },
    'shawn-mendes': {
        'name': 'Shawn Mendes',
        'keywords': ['shawn mendes', 'shawn-mendes'],
        'search_terms': ['shawn mendes'],
    },
    'sidhu-moosewala': {
        'name': 'Sidhu Moosewala',
        'keywords': ['sidhu moosewala', 'moosewala', 'moose wala', 'sidhu moose'],
        'search_terms': ['sidhu moosewala', 'moosewala', 'moose wala'],
    },
    'taylor-swift': {
        'name': 'Taylor Swift',
        'keywords': ['taylor swift', 'taylor-swift', 'swiftie', 'eras tour'],
        'search_terms': ['taylor swift', 'swiftie', 'eras tour'],
    },
}

# Featured artists for homepage (subset of all artists)
HOMEPAGE_ARTISTS = ['karan-aujla', 'diljit-dosanjh', 'honey-singh', 'coldplay']


def get_artist_keywords(handle: str) -> list:
    """Get keywords for a specific artist by handle.

    Args:
        handle: Artist collection handle (e.g., 'coldplay')

    Returns:
        list: Keywords for the artist, or empty list if not found
    """
    artist = ARTIST_COLLECTIONS.get(handle)
    if artist:
        return artist.get('keywords', [])
    return []


def get_all_artist_handles() -> list:
    """Get all artist collection handles."""
    return list(ARTIST_COLLECTIONS.keys())


def get_homepage_artist_config() -> list:
    """Get configuration for homepage featured artists.

    Returns:
        list: List of dicts with handle, name, and search_terms
    """
    return [
        {
            'handle': handle,
            'name': ARTIST_COLLECTIONS[handle]['name'],
            'search_terms': ARTIST_COLLECTIONS[handle].get('search_terms', []),
        }
        for handle in HOMEPAGE_ARTISTS
        if handle in ARTIST_COLLECTIONS
    ]
