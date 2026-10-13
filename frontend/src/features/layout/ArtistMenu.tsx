'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ArtistData } from '@yord/db-types';
import { MAX_MENU_ARTISTS, navLinkClasses } from './navLinks';

/** Rendered once, in the desktop header. */
const MENU_ID = 'artist-menu-dropdown';

export interface ArtistMenuProps {
  label: string;
  href: string;
  artists: ArtistData[];
  onMedia: boolean;
}

/**
 * The desktop `ARTISTS` nav item and its dropdown.
 *
 * The list is capped: the layout passes every published artist (65+), and an
 * uncapped dropdown ran thousands of pixels past the bottom of the viewport
 * with no way to scroll it. The rest are one click away on `/artists`, which is
 * where the item's own href already points.
 *
 * The dropdown stays mounted and toggles classes so the fade/slide is pure CSS;
 * `invisible` + `pointer-events-none` keep the closed menu out of the tab order
 * and off the hover path (the wrapper's mouse handlers still see the pointer
 * leave when it is closed).
 */
export function ArtistMenu({ label, href, artists, onMedia }: ArtistMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <Link href={href} aria-haspopup="true" aria-expanded={open} aria-controls={MENU_ID} className={navLinkClasses(onMedia)}>
        {label}
      </Link>

      <div
        id={MENU_ID}
        aria-hidden={!open}
        className={
          'absolute top-full left-1/2 -translate-x-1/2 pt-4 ' +
          'transition-[opacity,translate,visibility] duration-200 ease-out ' +
          (open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible pointer-events-none translate-y-2.5 opacity-0')
        }
      >
        <div className="glass min-w-[280px] py-4">
          {artists.slice(0, MAX_MENU_ARTISTS).map((artist) => (
            <Link
              key={artist.handle}
              href={`/artist/${artist.handle}`}
              className="flex items-center gap-3 px-6 py-3 hover:bg-surface-raised transition-colors"
            >
              {/* Brand colour as a mark, never as text: a brand yellow is
                  ~1.6:1 on the light page. */}
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: artist.accentColor }} />
              <span className="font-heading text-lg text-text-secondary">{artist.name}</span>
            </Link>
          ))}
          {artists.length > MAX_MENU_ARTISTS ? (
            <Link
              href={href}
              className="flex items-center gap-3 px-6 py-3 border-t border-border-default mt-2 font-accent text-xs tracking-[0.15em] text-accent hover:text-accent-hover transition-colors"
            >
              VIEW ALL ARTISTS
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
