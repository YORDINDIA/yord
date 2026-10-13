/**
 * Ink for a label painted on a caller-supplied accent background.
 *
 * The catalog and PDP take an `accentColor` that is either an artist brand
 * colour (a bright, theme-invariant hex) or the theme accent (`var(--accent)`,
 * which flips: bronze in light, gold in dark). The two need opposite inks, and
 * picking the wrong one is a contrast bug in exactly one theme:
 *
 *   - `--text-on-brand` (dark ink) on light bronze `--accent` is 3.28:1 —
 *     below AA for the 14px label that sits there.
 *   - `--text-on-accent` (flipping) on a brand yellow is ~1.3:1 in light mode,
 *     where the ink is near-white.
 *
 * A missing value means "the caller did not brand this", which is the theme
 * accent.
 */
export function accentInk(accentColor: string | undefined): string {
  return !accentColor || accentColor === 'var(--accent)'
    ? 'text-text-on-accent'
    : 'text-text-on-brand';
}
