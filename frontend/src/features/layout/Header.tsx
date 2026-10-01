'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingBag, User, Menu, X } from 'lucide-react';
import { cn } from '@yord/ui';
import { useCartStore } from '@/lib/stores/cartStore';
import type { ArtistData } from '@yord/db-types';
import { SearchModal } from './SearchModal';
import { ThemeToggle } from '@/features/ui/ThemeToggle';

const NAV_LINKS = [
  { label: 'NEW ARRIVALS', href: '/collection/new-arrivals' },
  { label: 'ARTISTS', href: '/artists', hasDropdown: true },
  { label: 'CONCERTS', href: '/concerts' },
  { label: 'COLLECTIONS', href: '/collections' },
  { label: 'BESTSELLERS', href: '/collection/bestsellers' },
  { label: 'BLOG', href: '/blog' },
];

interface HeaderProps {
  artists?: ArtistData[];
}

/* The transparent header sits on the dark hero on the home route, so the
   trigger keeps light-on-dark text there. Every other route — and the home
   route once scrolled — follows the theme. Resolved from the pathname rather
   than passed down, because the header is mounted once in the (main) layout
   and has to serve both cases. */
export function Header({ artists = [] }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isArtistDropdownOpen, setIsArtistDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();

  // Both the home hero and the artist hero are full-viewport dark media, and the
  // header is transparent over them until the page scrolls.
  const onMedia =
    !isScrolled && (pathname === '/' || pathname.startsWith('/artist/'));
  // On media: light-on-dark tokens. On the page surface: theme-following ones.
  const textTone = onMedia ? 'text-text-on-media' : 'text-text-primary';
  const textHover = onMedia ? 'hover:text-accent-on-media' : 'hover:text-accent';

  const hasHydrated = useCartStore((state) => state._hasHydrated);
  const cartItemCount = useCartStore((state) => state.itemCount());
  const toggleCart = useCartStore((state) => state.toggleCart);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

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
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link
              href="/"
              className="relative z-10 flex items-center group"
            >
              {/* Main Logo Container */}
              <div className="relative">
                {/* YORD - Premium Gradient Text */}
                <span
                  className="font-[family-name:var(--font-playfair)] text-2xl lg:text-3xl font-bold tracking-tight"
                  style={{
                    // Ivory→gold reads on the dark hero; on a light page an
                    // ivory start would be invisible, so the light theme
                    // reverses to ink→bronze.
                    background: onMedia
                      ? 'linear-gradient(135deg, var(--text-on-media) 0%, var(--accent-on-media) 45%, var(--text-on-media) 100%)'
                      : 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-on-surface) 45%, var(--text-primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  YORD
                </span>

                {/* Animated Underline */}
                <span
                  className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-accent/0 via-accent to-accent/0 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"
                />

                {/* Subtle Glow on Hover */}
                <span
                  className="absolute inset-0 blur-lg bg-accent/0 group-hover:bg-accent/15 transition-all duration-500 -z-10"
                />
              </div>

              {/* Decorative Diamond Separator */}
              <span className="mx-2 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                  <path
                    d="M3 0L6 3L3 6L0 3L3 0Z"
                    fill={onMedia ? 'var(--accent-on-media)' : 'var(--accent-on-surface)'}
                  />
                </svg>
              </span>

              {/* INDIA - Secondary Text */}
              <span
                className={cn(
                  "font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] transition-colors duration-300",
                  onMedia ? 'text-accent-on-media group-hover:text-text-on-media' : 'text-accent group-hover:text-accent-hover'
                )}
              >
                INDIA
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => link.hasDropdown && setIsArtistDropdownOpen(true)}
                  onMouseLeave={() => link.hasDropdown && setIsArtistDropdownOpen(false)}
                  onFocus={() => link.hasDropdown && setIsArtistDropdownOpen(true)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setIsArtistDropdownOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsArtistDropdownOpen(false);
                  }}
                >
                  <Link
                    href={link.href}
                    aria-haspopup={link.hasDropdown ? 'true' : undefined}
                    aria-expanded={link.hasDropdown ? isArtistDropdownOpen : undefined}
                    className={cn(
                      'font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em]',
                      onMedia ? `text-text-on-media-muted ${textHover}` : `text-text-secondary ${textHover}`,
                      'transition-colors duration-300',
                      'relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px]',
                      'after:bg-accent after:scale-x-0 after:origin-right',
                      'after:transition-transform after:duration-300',
                      'hover:after:scale-x-100 hover:after:origin-left'
                    )}
                  >
                    {link.label}
                  </Link>

                  {/* Artist Dropdown */}
                  {link.hasDropdown && (
                    <AnimatePresence>
                      {isArtistDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-1/2 -translate-x-1/2 pt-4"
                        >
                          <div className="glass min-w-[280px] py-4">
                            {artists.map((artist) => (
                              <Link
                                key={artist.handle}
                                href={`/artist/${artist.handle}`}
                                className="flex items-center gap-3 px-6 py-3 hover:bg-surface-raised transition-colors"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: artist.accentColor }}
                                />
                                <span className="font-[family-name:var(--font-cormorant)] text-lg text-text-secondary">
                                  {artist.name}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {/* Theme */}
              <ThemeToggle className="hidden sm:block" tone={onMedia ? 'media' : 'surface'} />

              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className={cn('hidden sm:flex w-10 h-10 items-center justify-center transition-colors', textTone, textHover)}
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              {/* Account */}
              <Link
                href="/account"
                className={cn('hidden sm:flex w-10 h-10 items-center justify-center transition-colors', textTone, textHover)}
                aria-label="Account"
              >
                <User size={20} />
              </Link>

              {/* Cart */}
              <button
                onClick={toggleCart}
                className={cn('relative w-10 h-10 flex items-center justify-center transition-colors', textTone, textHover)}
                aria-label={`Cart with ${hasHydrated ? cartItemCount : 0} items`}
              >
                <ShoppingBag size={20} />
                {hasHydrated && cartItemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-accent text-text-on-accent text-[10px] font-bold rounded-full"
                  >
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </motion.span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={cn('lg:hidden w-10 h-10 flex items-center justify-center transition-colors', textTone, textHover)}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-surface-page/95 backdrop-blur-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Content */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface-page border-l border-border-default"
            >
              <div className="pt-24 px-8">
                {/* Main Links */}
                <div className="space-y-6">
                  {NAV_LINKS.map((link, index) => (
                    <motion.div
                      key={link.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block font-[family-name:var(--font-playfair)] text-3xl text-text-primary hover:text-accent transition-colors"
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Artist Links */}
                <div className="mt-12 pt-8 border-t border-border-default">
                  <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-6">
                    FEATURED ARTISTS
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {artists.map((artist, index) => (
                      <motion.div
                        key={artist.handle}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                      >
                        <Link
                          href={`/artist/${artist.handle}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-2 text-text-secondary hover:text-accent transition-colors"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: artist.accentColor }}
                          />
                          <span className="font-[family-name:var(--font-cormorant)] text-lg">
                            {artist.name}
                          </span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Appearance */}
                <div className="mt-12 pt-8 border-t border-border-default">
                  <ThemeToggle variant="inline" />
                </div>

                {/* Account Links */}
                <div className="mt-12 pt-8 border-t border-border-default space-y-4">
                  <Link
                    href="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-text-secondary hover:text-accent transition-colors"
                  >
                    <User size={20} />
                    <span className="font-[family-name:var(--font-jakarta)]">Account</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSearchOpen(true);
                    }}
                    className="flex items-center gap-3 text-text-secondary hover:text-accent transition-colors"
                  >
                    <Search size={20} />
                    <span className="font-[family-name:var(--font-jakarta)]">Search</span>
                  </button>
                </div>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
