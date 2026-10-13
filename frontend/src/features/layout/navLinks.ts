import { cn } from '@yord/ui';

export interface NavLink {
  label: string;
  href: string;
  /** Rendered by `ArtistMenu` rather than as a plain link. */
  hasDropdown?: boolean;
}

/** The desktop nav. `ARTISTS` is rendered by `ArtistMenu` (it owns a dropdown). */
export const NAV_LINKS: readonly NavLink[] = [
  { label: 'NEW ARRIVALS', href: '/collection/new-arrivals' },
  { label: 'ARTISTS', href: '/artists', hasDropdown: true },
  { label: 'CONCERTS', href: '/concerts' },
  { label: 'COLLECTIONS', href: '/collections' },
  { label: 'BESTSELLERS', href: '/collection/bestsellers' },
  { label: 'BLOG', href: '/blog' },
];

/**
 * The nav link recipe: tone-dependent colour plus the accent underline that
 * wipes in from the left on hover.
 *
 * The underline follows the same tone as the text. On a media route the page
 * accent is bronze in the light theme, which is close to invisible over a dark
 * hero — the underline there has to be `--accent-on-media`.
 */
export function navLinkClasses(onMedia: boolean): string {
  return cn(
    'font-accent text-sm tracking-[0.15em] transition-colors duration-300',
    onMedia ? 'text-text-on-media-muted hover:text-accent-on-media' : 'text-text-secondary hover:text-accent',
    'relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px]',
    onMedia ? 'after:bg-accent-on-media' : 'after:bg-accent',
    'after:scale-x-0 after:origin-right',
    'after:transition-transform after:duration-300',
    'hover:after:scale-x-100 hover:after:origin-left'
  );
}

/** How many artists the header menus list before deferring to `/artists`. */
export const MAX_MENU_ARTISTS = 6;

/**
 * The mobile drawer's nav id. The header's toggle points `aria-controls` at it,
 * so the two files cannot drift apart.
 */
export const MOBILE_MENU_ID = 'mobile-menu';
