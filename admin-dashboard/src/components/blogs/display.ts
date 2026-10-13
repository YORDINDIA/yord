/**
 * Presentation helpers for the blogs and articles screens.
 *
 * Pure functions with no imports, so the server pages, the client editors, and
 * any future test all share one implementation. They live beside the
 * components instead of in `@/lib/utils/format` because only this domain needs
 * article text metrics and storefront article paths; absolute date/currency
 * formatting still comes from the shared module.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Average adult reading speed, used for the editor's reading-time estimate. */
const WORDS_PER_MINUTE = 220;

/** The storefront's blog index — the only storefront route a *blog* has. */
export const BLOG_INDEX_PATH = '/blog';

/**
 * Recommended excerpt length. The storefront truncates the stripped excerpt at
 * 160 characters for the article page's meta description and at 120–150 in the
 * cards, so anything past 160 is a silent cut and anything under 80 wastes the
 * most-read sentence of the page.
 */
export const EXCERPT_MIN = 80;
export const EXCERPT_MAX = 160;

/**
 * Compact relative age for a dense table cell — "just now", "12m ago",
 * "3d ago", "2mo ago". Pair it with `formatTimestamp` in the cell's `title`.
 *
 * `now` is injectable so the label is deterministic; the pages pass nothing and
 * the server's clock is used.
 */
export function formatRelative(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return '—';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '—';

  const diff = now - time;
  // A timestamp slightly in the future (clock skew between the database and
  // this server) reads better as "just now" than as a negative age.
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;

  const days = Math.floor(diff / DAY);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.max(1, Math.floor(days / 365))}y ago`;
}

/** Full timestamp for a cell's `title` — the exact time behind a relative label. */
export function formatTimestamp(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Visible text of an admin-authored HTML fragment.
 *
 * Strips tags, decodes the handful of entities that change a character count
 * (`&amp;` is one character on screen, five in the source), and folds runs of
 * whitespace so a pasted document does not inflate the word count.
 * `@yord/ui`'s `stripHtml` is the right primitive for the storefront's own
 * display strings; this one exists for counting, not for rendering.
 */
export function stripTags(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    // Any other entity renders as one character, so it counts as one.
    .replace(/&[a-z]+;|&#\d+;/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TextMetrics {
  words: number;
  characters: number;
  /** Whole minutes, never below 1 when there is any text at all. */
  minutes: number;
}

/** Word count, character count, and reading time for a body of HTML. */
export function textMetrics(html: string | null | undefined): TextMetrics {
  const text = stripTags(html);
  const words = text ? text.split(' ').filter(Boolean).length : 0;
  return {
    words,
    characters: text.length,
    minutes: words > 0 ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0,
  };
}

export type ExcerptState = 'empty' | 'short' | 'good' | 'long';

/** Length of the excerpt as the storefront sees it, plus a verdict to colour. */
export function excerptCheck(html: string | null | undefined): {
  length: number;
  state: ExcerptState;
  hint: string;
} {
  const length = stripTags(html).length;
  if (length === 0) {
    return {
      length,
      state: 'empty',
      hint: 'No excerpt — the storefront cards and the meta description fall back to nothing.',
    };
  }
  if (length < EXCERPT_MIN) {
    return {
      length,
      state: 'short',
      hint: `Short (${length} characters). ${EXCERPT_MIN}–${EXCERPT_MAX} reads better in cards and search results.`,
    };
  }
  if (length > EXCERPT_MAX) {
    return {
      length,
      state: 'long',
      hint: `${length} characters — the storefront cuts the excerpt at ${EXCERPT_MAX}.`,
    };
  }
  return { length, state: 'good', hint: `Good length (${length} of ${EXCERPT_MAX} characters).` };
}

/**
 * Storefront image for an article. The media-library URL wins over the legacy
 * Shopify CDN one, matching how the storefront resolves it
 * (`frontend/src/app/(main)/blog/[slug]/page.tsx`).
 */
export function articleImageUrl(article: {
  image_src?: string | null;
  storage_image_url?: string | null;
}): string | null {
  return article.storage_image_url || article.image_src || null;
}

/** Storefront path for an article, or null when it has no handle to build one. */
export function articlePath(handle: string | null | undefined): string | null {
  const slug = handle?.trim();
  return slug ? `${BLOG_INDEX_PATH}/${slug}` : null;
}

/** `3 articles` / `1 article` without a template library. */
export function articleCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'article' : 'articles'}`;
}

/** `2 live` / `No live articles` — the blog row's derived publish state. */
export function liveLabel(publishedCount: number): string {
  return publishedCount > 0 ? `${publishedCount} live` : 'No live articles';
}
