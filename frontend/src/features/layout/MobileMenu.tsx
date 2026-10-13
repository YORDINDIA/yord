'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Search, User, X } from 'lucide-react';
import type { ArtistData } from '@yord/db-types';
import { Overlay } from '@/features/ui/Overlay';
import { IconButton } from '@/features/ui/IconButton';
import { ThemeToggle } from '@/features/ui/ThemeToggle';
import { orderArtistsWithPinnedFirst } from '@/features/artist/orderArtists';
import { MAX_MENU_ARTISTS, MOBILE_MENU_ID, NAV_LINKS } from './navLinks';

/** The `lg` breakpoint, where the header's own nav takes over. */
const DESKTOP_QUERY = '(min-width: 1024px)';

export interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  artists: ArtistData[];
  onOpenSearch: () => void;
  /** Warms the search modal's chunk on intent, same as the header's trigger. */
  onWarmSearch: () => void;
}

/**
 * The header's mobile drawer.
 *
 * It used to be a hand-rolled full-screen overlay: an `onClick` backdrop with
 * no `role="dialog"`, no `aria-modal`, no focus trap, no focus restore, and no
 * Escape handler. `Overlay` supplies all of that (and the reference-counted
 * body scroll lock, so it can no longer release the lock a cart drawer holds).
 *
 * Two things changed visibly: the drawer now covers the header on phones (it is
 * portalled to `body` at the same z-index, so it paints last), which is why it
 * carries its own close button; and the per-item entrance stagger is gone — the
 * last link in a 65-artist list could take seconds to appear.
 */
export function MobileMenu({ open, onClose, artists, onOpenSearch, onWarmSearch }: MobileMenuProps) {
  // The toggle that opens this is `lg:hidden`. Resizing to desktop while the
  // drawer is open would otherwise leave a modal scrim over a page whose own
  // nav is now the primary one.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (query.matches) onClose();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [open, onClose]);

  const featured = orderArtistsWithPinnedFirst(artists).slice(0, MAX_MENU_ARTISTS);

  return (
    <Overlay open={open} onClose={onClose} variant="right" label="Menu">
      <div className="flex items-center justify-between pl-8 pr-4 py-4 border-b border-border-default">
        <span className="font-accent text-xs tracking-[0.2em] text-text-muted">MENU</span>
        <IconButton label="Close menu" onClick={onClose}>
          <X size={24} />
        </IconButton>
      </div>

      {/* Scrollable region: the theme control plus the artist list can push
          Account/Search past short phone viewports, and the body scroll is
          locked while the drawer is open. */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-8">
        <nav id={MOBILE_MENU_ID} aria-label="Mobile">
          <div className="space-y-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={onClose}
                className="block font-display text-3xl text-text-primary hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {featured.length > 0 ? (
            <div className="mt-12 pt-8 border-t border-border-default">
              <p className="font-accent text-xs tracking-[0.2em] text-text-muted mb-6">
                FEATURED ARTISTS
              </p>
              <div className="grid grid-cols-2 gap-4">
                {featured.map((artist) => (
                  <Link
                    key={artist.handle}
                    href={`/artist/${artist.handle}`}
                    onClick={onClose}
                    className="flex items-center gap-2 text-text-secondary hover:text-accent transition-colors"
                  >
                    {/* Brand colour as a mark, never as text. */}
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: artist.accentColor }} />
                    <span className="font-heading text-lg">{artist.name}</span>
                  </Link>
                ))}
              </div>
              {artists.length > MAX_MENU_ARTISTS ? (
                <Link
                  href="/artists"
                  onClick={onClose}
                  className="inline-block mt-4 font-accent text-xs tracking-[0.15em] text-accent hover:text-accent-hover transition-colors"
                >
                  VIEW ALL ARTISTS
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="mt-12 pt-8 border-t border-border-default">
            <ThemeToggle variant="inline" />
          </div>

          <div className="mt-12 pt-8 border-t border-border-default space-y-4">
            <Link
              href="/account"
              onClick={onClose}
              className="flex items-center gap-3 text-text-secondary hover:text-accent transition-colors"
            >
              <User size={20} />
              <span className="font-body">Account</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSearch();
              }}
              onPointerEnter={onWarmSearch}
              onFocus={onWarmSearch}
              className="flex items-center gap-3 text-text-secondary hover:text-accent transition-colors"
            >
              <Search size={20} />
              <span className="font-body">Search</span>
            </button>
          </div>
        </nav>
      </div>
    </Overlay>
  );
}
