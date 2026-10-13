import { ARTISTS } from '@yord/db-types';
import type { BadgeType } from '@yord/db-types';
import type { ConceptProduct } from './loaders';

/* DEV-ONLY stand-ins for the catalog when Supabase is not configured locally
   (loaders.ts guards this with NODE_ENV !== 'production'). Titles and prices
   are placeholders shaped like the real catalog; images are the local artist
   photos so grids can be reviewed with real proportions. Never shipped. */

const LINES: Array<{ title: string; price: number; compareAt: number | null; badge: BadgeType | null }> = [
  { title: 'Oversized Tour T-Shirt', price: 1499, compareAt: null, badge: 'BESTSELLER' },
  { title: 'Glow In Dark T-Shirt', price: 1499, compareAt: null, badge: 'NEW' },
  { title: 'Embroidered Denim Jacket', price: 5000, compareAt: 6200, badge: 'LIMITED' },
  { title: 'Zip-Up Hoodie', price: 1499, compareAt: null, badge: null },
  { title: 'Regular Fit T-Shirt', price: 900, compareAt: null, badge: null },
  { title: 'Holographic Print T-Shirt', price: 1100, compareAt: null, badge: 'TRENDING' },
];

export function fixtureProducts(handle: string, count: number, offset = 0): ConceptProduct[] {
  const artist = ARTISTS[handle];
  if (!artist) return [];
  return Array.from({ length: count }, (_, i) => {
    const line = LINES[(i + offset) % LINES.length];
    return {
      id: `fixture-${handle}-${i + offset}`,
      handle: `fixture-${handle}-${i + offset}`,
      title: `${artist.name} ${line.title}`,
      artist: artist.name,
      price: line.price,
      compareAtPrice: line.compareAt,
      image: artist.heroImage ?? null,
      badge: line.badge,
      accentColor: artist.accentColor || 'var(--accent)',
    };
  });
}

/** A mixed set across artists, for featured grids. */
export function fixtureFeatured(count: number): ConceptProduct[] {
  const handles = ['coldplay', 'diljit-dosanjh', 'karan-aujla', 'honey-singh'];
  return Array.from({ length: count }, (_, i) =>
    fixtureProducts(handles[i % handles.length], 1, Math.floor(i / handles.length) * 2 + i)[0]
  ).filter(Boolean);
}
