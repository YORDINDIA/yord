"""Centralized configuration for YORD migration scripts."""

import os
from dotenv import load_dotenv

load_dotenv()


def get_project_ref() -> str:
    """Get Supabase project reference from environment or default."""
    return os.getenv('SUPABASE_PROJECT_REF', 'zbxvholbndkgqgbdefzx')


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
        'keywords': ['karan aujla', 'karan', 'aujla', 'karanaujla'],
        'search_terms': ['karan aujla', 'karan', 'aujla', 'karanaujla'],
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
