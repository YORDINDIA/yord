'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingBag, User, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCartStore } from '@/lib/stores/cartStore';
import { ARTISTS, ARTIST_COLLECTION_HANDLES, type ArtistData } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { SearchModal } from './SearchModal';

const NAV_LINKS = [
  { label: 'NEW ARRIVALS', href: '/collection/new-arrivals' },
  { label: 'ARTISTS', href: '/artists', hasDropdown: true },
  { label: 'CONCERTS', href: '/concerts' },
  { label: 'COLLECTIONS', href: '/collections' },
  { label: 'BESTSELLERS', href: '/collection/bestsellers' },
  { label: 'BLOG', href: '/blog' },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isArtistDropdownOpen, setIsArtistDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [artists, setArtists] = useState<ArtistData[]>([]);

  const hasHydrated = useCartStore((state) => state._hasHydrated);
  const cartItemCount = useCartStore((state) => state.itemCount());
  const toggleCart = useCartStore((state) => state.toggleCart);

  // Fetch artists dynamically from collections
  useEffect(() => {
    async function fetchArtists() {
      const supabase = createClient();

      // Get artist collections
      const { data: collections } = await supabase
        .from('collections')
        .select('id, title, handle')
        .in('handle', ARTIST_COLLECTION_HANDLES as unknown as string[]);

      if (collections) {
        // Get product counts for each collection
        const artistsWithCounts = await Promise.all(
          (collections as { id: number; title: string; handle: string | null }[]).map(async (col) => {
            const { count } = await supabase
              .from('collects')
              .select('*', { count: 'exact', head: true })
              .eq('collection_id', col.id);

            const handle = col.handle || '';
            const metadata = ARTISTS[handle];

            return {
              handle,
              name: metadata?.name || col.title,
              vendorName: col.title,
              tagline: metadata?.tagline || 'Artist-Inspired',
              bio: metadata?.bio || '',
              heroImage: metadata?.heroImage || '/images/default-artist.jpg',
              accentColor: metadata?.accentColor || '#D4AF37',
              secondaryColor: metadata?.secondaryColor || '#1a1a1a',
              productCount: count || 0,
            } as ArtistData;
          })
        );

        // Filter out artists with 0 products and sort by count
        setArtists(
          artistsWithCounts
            .filter(a => a.productCount && a.productCount > 0)
            .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
        );
      }
    }

    fetchArtists();
  }, []);

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
            ? 'bg-noir-950/95 backdrop-blur-lg border-b border-noir-800'
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
                    background: 'linear-gradient(135deg, var(--ivory-50) 0%, var(--gold-100) 40%, var(--gold-200) 60%, var(--ivory-50) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  YORD
                </span>

                {/* Animated Underline */}
                <span
                  className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-gold-200/0 via-gold-200 to-gold-200/0 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center"
                />

                {/* Subtle Glow on Hover */}
                <span
                  className="absolute inset-0 blur-lg bg-gold-200/0 group-hover:bg-gold-200/15 transition-all duration-500 -z-10"
                />
              </div>

              {/* Decorative Diamond Separator */}
              <span className="mx-2 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                  <path d="M3 0L6 3L3 6L0 3L3 0Z" fill="var(--gold-200)" />
                </svg>
              </span>

              {/* INDIA - Secondary Text */}
              <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-gold-200 group-hover:text-gold-100 transition-colors duration-300">
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
                >
                  <Link
                    href={link.href}
                    className={cn(
                      'font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] text-ivory-100',
                      'hover:text-gold-200 transition-colors duration-300',
                      'relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px]',
                      'after:bg-gold-200 after:scale-x-0 after:origin-right',
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
                                className="flex items-center gap-3 px-6 py-3 hover:bg-noir-800 transition-colors"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: artist.accentColor }}
                                />
                                <span className="font-[family-name:var(--font-cormorant)] text-lg text-ivory-100">
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
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:flex w-10 h-10 items-center justify-center text-ivory-100 hover:text-gold-200 transition-colors"
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              {/* Account */}
              <Link
                href="/account"
                className="hidden sm:flex w-10 h-10 items-center justify-center text-ivory-100 hover:text-gold-200 transition-colors"
                aria-label="Account"
              >
                <User size={20} />
              </Link>

              {/* Cart */}
              <button
                onClick={toggleCart}
                className="relative w-10 h-10 flex items-center justify-center text-ivory-100 hover:text-gold-200 transition-colors"
                aria-label={`Cart with ${hasHydrated ? cartItemCount : 0} items`}
              >
                <ShoppingBag size={20} />
                {hasHydrated && cartItemCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-gold-200 text-noir-950 text-[10px] font-bold rounded-full"
                  >
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </motion.span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden w-10 h-10 flex items-center justify-center text-ivory-100 hover:text-gold-200 transition-colors"
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
              className="absolute inset-0 bg-noir-950/95 backdrop-blur-lg"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Content */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-noir-950 border-l border-noir-800"
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
                        className="block font-[family-name:var(--font-playfair)] text-3xl text-ivory-50 hover:text-gold-200 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Artist Links */}
                <div className="mt-12 pt-8 border-t border-noir-700">
                  <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-ivory-400 mb-6">
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
                          className="flex items-center gap-2 text-ivory-100 hover:text-gold-200 transition-colors"
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

                {/* Account Links */}
                <div className="mt-12 pt-8 border-t border-noir-700 space-y-4">
                  <Link
                    href="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 text-ivory-100 hover:text-gold-200 transition-colors"
                  >
                    <User size={20} />
                    <span className="font-[family-name:var(--font-jakarta)]">Account</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsSearchOpen(true);
                    }}
                    className="flex items-center gap-3 text-ivory-100 hover:text-gold-200 transition-colors"
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
