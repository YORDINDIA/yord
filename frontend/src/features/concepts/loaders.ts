import { ARTISTS } from '@yord/db-types';
import type { ArtistData, ProductWithDetails, TransformedProduct } from '@yord/db-types';
import { getFeaturedProductsCached, getTopProductsCached } from '@/lib/supabase/cached-queries';
import { getTopProductsByArtistHandle } from '@/lib/supabase/queries';
import { getUpcomingConcertsByArtist } from '@/lib/data/concerts';
import { getFirstByPosition, getProductBadge } from '@/lib/product';
import { degrade, isSupabaseUnconfigured } from '@/lib/result';
import { fixtureFeatured, fixtureProducts } from './fixtures';

/* Server-side data for the design concepts. The original home sections do the
   same reads inside their own server wrappers; this module exists so the three
   concepts share one copy of the transform instead of three. It reuses the
   same cached queries, so concepts add no extra database load. */

export const RAIL_HANDLES = ['karan-aujla', 'diljit-dosanjh', 'honey-singh', 'coldplay'] as const;

/** Card-ready product. `originalProduct` is absent only on dev fixtures. */
export type ConceptProduct = TransformedProduct & { originalProduct?: ProductWithDetails };

export interface ConcertShelf {
  artistHandle: string;
  artistName: string;
  artistImage?: string;
  accentColor: string;
  secondaryColor: string;
  tourName: string;
  nextShowDate: string;
  nextShowCity: string;
  nextShowVenue: string;
  totalUpcomingShows: number;
  products: ConceptProduct[];
}

/** True when local dev has no Supabase env: loaders then return fixtures. */
const shouldUseFixtures = () => process.env.NODE_ENV !== 'production' && isSupabaseUnconfigured();

function toCard(p: ProductWithDetails, accentColor: string, fallbackArtist: string): ConceptProduct {
  const variant = getFirstByPosition(p.product_variants);
  const image = getFirstByPosition(p.product_images);
  return {
    id: p.id.toString(),
    handle: p.handle ?? '',
    title: p.title,
    artist: p.vendor || fallbackArtist,
    price: variant?.price || 0,
    compareAtPrice: variant?.compare_at_price || null,
    image: image?.storage_url || image?.src || null,
    badge: getProductBadge(p, variant),
    accentColor,
    originalProduct: p,
  };
}

/** Artists that have a hero photo, in config order. Static, no network. */
export function getShowcaseArtists(): ArtistData[] {
  return Object.values(ARTISTS).filter((a) => a.heroImage);
}

/** Featured products, or null when the read failed (render a retry state). */
export async function loadFeatured(limit = 8): Promise<ConceptProduct[] | null> {
  if (shouldUseFixtures()) return fixtureFeatured(limit);
  const result = await degrade(getFeaturedProductsCached(limit), [], 'concepts:featured', 'products');
  if (!result.ok) return null;
  return result.value
    .filter((p) => p.handle)
    .map((p) => {
      const handle = p.vendor?.toLowerCase().replace(/\s+/g, '-') || '';
      return toCard(p, ARTISTS[handle]?.accentColor || 'var(--accent)', 'YORD');
    });
}

export interface ArtistRail {
  artist: ArtistData;
  products: ConceptProduct[];
}

/** One artist's top products, or null when the artist is unknown, empty or failed. */
export async function loadArtistRail(handle: string, limit = 4): Promise<ArtistRail | null> {
  const artist = ARTISTS[handle];
  if (!artist) return null;
  if (shouldUseFixtures()) return { artist, products: fixtureProducts(handle, limit) };
  const result = await degrade(
    getTopProductsCached(handle, limit),
    [],
    `concepts:artist-${handle}`,
    'products'
  );
  if (!result.ok || result.value.length === 0) return null;
  const accent = artist.accentColor || 'var(--accent)';
  return { artist, products: result.value.map((p) => toCard(p, accent, artist.name)) };
}

/** Upcoming-concert shelves. A failing artist is skipped, never the whole list. */
export async function loadConcerts(): Promise<{ shelves: ConcertShelf[]; now: number }> {
  const now = Date.now();
  const fixtures = shouldUseFixtures();
  const shelves = (
    await Promise.all(
      getUpcomingConcertsByArtist().map(
        async ({ artistHandle, tourName, nextShow, allUpcoming }): Promise<ConcertShelf | null> => {
          const artist = ARTISTS[artistHandle];
          if (!artist) return null;
          let products: ConceptProduct[];
          const accent = artist.accentColor || 'var(--accent)';
          if (fixtures) {
            products = fixtureProducts(artistHandle, 4);
          } else {
            try {
              const rows = await getTopProductsByArtistHandle(artistHandle, 4, true);
              products = rows.map((p) => toCard(p, accent, artist.name));
            } catch {
              return null;
            }
          }
          if (products.length === 0) return null;
          return {
            artistHandle,
            artistName: artist.name,
            artistImage: artist.heroImage,
            accentColor: accent,
            secondaryColor: artist.secondaryColor || '#1C1C1C',
            tourName,
            nextShowDate: nextShow.date,
            nextShowCity: nextShow.city,
            nextShowVenue: nextShow.venue,
            totalUpcomingShows: allUpcoming.length,
            products,
          };
        }
      )
    )
  ).filter((s): s is ConcertShelf => s !== null);
  return { shelves, now };
}
