/**
 * Which palette the transparent header paints.
 *
 * The header is transparent until the page scrolls, so on a route whose hero is
 * full-bleed dark media it sits directly on that media and has to use the
 * on-media family (`--text-on-media`, `--accent-on-media`) — those are
 * theme-invariant precisely because the hero is dark in both themes. Everywhere
 * else, and on any media route once scrolled, it follows the theme.
 *
 * A new full-viewport hero means adding its route here. The route list lives in
 * this module rather than inline in `Header.tsx` so `theme.test.ts` can assert
 * against the data instead of grepping for a regex.
 */
export const MEDIA_ROUTES = ['/'] as const;

export const MEDIA_ROUTE_PREFIXES = ['/artist/', '/concepts/'] as const;

/** Routes under a media prefix whose hero is a light page, not dark media. */
export const SURFACE_ROUTES = ['/concepts/rail'] as const;

/** Scroll offset, in px, at which the header stops being transparent. */
export const SCROLL_THRESHOLD = 50;

export function isMediaRoute(pathname: string): boolean {
  if ((SURFACE_ROUTES as readonly string[]).includes(pathname)) return false;
  return (
    (MEDIA_ROUTES as readonly string[]).includes(pathname) ||
    MEDIA_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** The two text tones, as class strings so callers stay declarative. */
export const HEADER_TONE = {
  media: { text: 'text-text-on-media', hover: 'hover:text-accent-on-media' },
  surface: { text: 'text-text-primary', hover: 'hover:text-accent' },
} as const;

export function headerTone(pathname: string, isScrolled: boolean) {
  const onMedia = !isScrolled && isMediaRoute(pathname);
  return { onMedia, ...HEADER_TONE[onMedia ? 'media' : 'surface'] };
}
