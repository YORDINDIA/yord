'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { ArtistData } from '@/types/database';

interface ArtistsPageClientProps {
  artists: ArtistData[];
}

export function ArtistsPageClient({ artists }: ArtistsPageClientProps) {
  return (
    <div className="min-h-screen bg-noir-950">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-gold-200 mb-4"
          >
            ARTIST-INSPIRED
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6"
          >
            Featured Artists
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-2xl mx-auto"
          >
            Explore exclusive concert merchandise from the world&apos;s most iconic artists.
            Premium quality, authentic designs, unforgettable memories.
          </motion.p>
        </div>
      </section>

      {/* Artists Grid */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {artists.map((artist, index) => (
              <motion.div
                key={artist.handle}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
              >
                <Link
                  href={`/artist/${artist.handle}`}
                  className="group block relative overflow-hidden bg-noir-900 border border-noir-800 hover:border-noir-700 transition-all duration-500"
                >
                  {/* Artist Image */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-noir-800">
                    <Image
                      src={artist.heroImage || '/artists/default-hero.jpg'}
                      alt={artist.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Gradient Overlay */}
                    <div
                      className="absolute inset-0 opacity-60"
                      style={{
                        background: `linear-gradient(to top, ${artist.secondaryColor || '#1C1C1C'}ee 0%, transparent 60%)`,
                      }}
                    />
                    {/* Accent Border on Hover */}
                    <div
                      className="absolute inset-0 border-2 border-transparent group-hover:border-current transition-colors duration-500"
                      style={{ color: artist.accentColor || '#FFD700' }}
                    />
                  </div>

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: artist.accentColor || '#FFD700' }}
                      />
                      <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.15em] text-ivory-300">
                        {artist.tagline || 'Fan Collection'}
                      </span>
                    </div>
                    <h2 className="font-[family-name:var(--font-playfair)] text-2xl md:text-3xl text-ivory-50 mb-3">
                      {artist.name}
                    </h2>
                    <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 line-clamp-2 mb-4">
                      {artist.bio || `Shop exclusive ${artist.name} merchandise.`}
                    </p>

                    {/* Product Count Badge */}
                    {artist.productCount && (
                      <div className="mb-3">
                        <span
                          className="inline-flex items-center px-2 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider"
                          style={{
                            backgroundColor: `${artist.accentColor || '#FFD700'}20`,
                            color: artist.accentColor || '#FFD700',
                          }}
                        >
                          {artist.productCount} PRODUCTS
                        </span>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="flex items-center gap-2 text-sm font-[family-name:var(--font-bebas)] tracking-wider">
                      <span
                        className="transition-colors duration-300"
                        style={{ color: artist.accentColor }}
                      >
                        SHOP COLLECTION
                      </span>
                      <ArrowRight
                        size={16}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                        style={{ color: artist.accentColor }}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-[1440px] mx-auto">
          <div className="relative bg-noir-900 border border-noir-800 p-12 md:p-16 text-center overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: '40px 40px',
              }} />
            </div>

            <div className="relative z-10">
              <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50 mb-4">
                More Artists Coming Soon
              </h2>
              <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-lg mx-auto mb-8">
                Be the first to know when we add new artists to our collection.
                Join our community for exclusive drops and early access.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
              >
                EXPLORE ALL PRODUCTS
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
