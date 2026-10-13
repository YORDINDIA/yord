'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@yord/ui';
import type { ArtistData } from '@yord/db-types';
import { Logo } from './Logo';
import { ArtistMenu } from './ArtistMenu';
import { HeaderActions } from './HeaderActions';
import { MobileMenu } from './MobileMenu';
import { MOBILE_MENU_ID, NAV_LINKS, navLinkClasses } from './navLinks';
import { headerTone } from './headerTone';
import { useScrollState } from './useScrollState';

/* The search modal is a sizeable client subtree (Supabase queries + result
   markup) that is only needed once the shopper asks for it, so it is split out
   of the header's chunk — and therefore out of every route's initial JS. */
const SearchModal = dynamic(
  () => import('./SearchModal').then((m) => m.SearchModal),
  { ssr: false }
);

/* Warm the modal's chunk on intent (hover/focus of a search trigger) so the
   first open is not gated on a network round-trip. Resolves the same module
   the dynamic() import above does. */
function warmSearchModal() {
  void import('./SearchModal');
}

interface HeaderProps {
  artists?: ArtistData[];
}

/**
 * The storefront header: a transparent bar over media routes, a solid one
 * everywhere else.
 *
 * Decomposed because it was 422 lines doing six jobs. The pieces now live in
 * sibling modules — scroll state (`useScrollState`), the route-derived palette
 * (`headerTone`), the wordmark (`Logo`), the artist dropdown (`ArtistMenu`),
 * the action cluster (`HeaderActions`) and the mobile drawer (`MobileMenu`).
 * What is left here is the layout and the open/close wiring.
 */
export function Header({ artists = [] }: HeaderProps) {
  const pathname = usePathname();
  const isScrolled = useScrollState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Latched after the first open. The modal has to stay mounted through
  // `Overlay`'s exit transition, but rendering it before the shopper asks for
  // it would fetch its chunk on every route — the opposite of the split above.
  const [searchMounted, setSearchMounted] = useState(false);

  const { onMedia } = headerTone(pathname, isScrolled);

  const openSearch = () => {
    setSearchMounted(true);
    setSearchOpen(true);
  };
  const closeSearch = () => setSearchOpen(false);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          isScrolled
            ? 'bg-surface-page/95 backdrop-blur-lg border-b border-border-default'
            : 'bg-transparent'
        )}
      >
        <div className="container-page">
          <div className="flex items-center justify-between h-20">
            <Logo tone={onMedia ? 'media' : 'surface'} className="relative z-10" />

            <nav className="hidden lg:flex items-center gap-8" aria-label="Main">
              {NAV_LINKS.map((link) =>
                link.hasDropdown ? (
                  <ArtistMenu
                    key={link.label}
                    label={link.label}
                    href={link.href}
                    artists={artists}
                    onMedia={onMedia}
                  />
                ) : (
                  <Link key={link.label} href={link.href} className={navLinkClasses(onMedia)}>
                    {link.label}
                  </Link>
                )
              )}
            </nav>

            <HeaderActions
              onMedia={onMedia}
              menuOpen={menuOpen}
              menuId={MOBILE_MENU_ID}
              onToggleMenu={() => setMenuOpen((prev) => !prev)}
              onOpenSearch={openSearch}
              onWarmSearch={warmSearchModal}
            />
          </div>
        </div>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        artists={artists}
        onOpenSearch={openSearch}
        onWarmSearch={warmSearchModal}
      />

      {searchMounted && <SearchModal isOpen={searchOpen} onClose={closeSearch} />}
    </>
  );
}
