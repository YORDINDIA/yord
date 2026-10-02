import type { ConceptProduct } from '@/features/concepts/loaders';

/** ProductCard lifts and shadows itself on hover; the poster world stays flat. */
export const FLAT_CARD = 'shadow-none! hover:shadow-none! hover:translate-y-0!';

export function cardProps(p: ConceptProduct) {
  return {
    handle: p.handle,
    title: p.title,
    artist: p.artist,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.image,
    badge: p.badge,
    accentColor: p.accentColor,
    product: p.originalProduct,
  };
}

/** Readable ink for text sitting on a colour: dark brand ink or on-media ivory, whichever contrasts more. */
export function inkFor(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return 'var(--text-on-brand)';
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onDark = (lum + 0.05) / 0.053;
  const onLight = 1 / (lum + 0.05);
  return onDark >= onLight ? 'var(--text-on-brand)' : 'var(--text-on-media)';
}
