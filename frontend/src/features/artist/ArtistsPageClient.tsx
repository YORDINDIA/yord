'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/features/ui/Container';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { Reveal } from '@/features/ui/Reveal';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { orderArtistsWithPinnedFirst } from './orderArtists';
import type { ArtistData } from '@yord/db-types';

interface ArtistsPageClientProps {
  artists: ArtistData[];
}

export function ArtistsPageClient({ artists }: ArtistsPageClientProps) {
  const orderedArtists = orderArtistsWithPinnedFirst(artists);

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <Container as="section" className="pt-32 pb-20">
        <Reveal>
          <SectionHeading
            as="h1"
            align="center"
            eyebrow="ARTIST-INSPIRED"
            title="Featured Artists"
            description="Explore exclusive concert merchandise from the world's most iconic artists. Premium quality, authentic designs, unforgettable memories."
          />
        </Reveal>
      </Container>

      {/* Artists Grid */}
      <Container as="section" className="pb-24">
        {artists.length === 0 ? (
          <EmptyState
            title="No artists to show yet"
            message="New artist collections are added as their drops go live. Browse everything we have in the meantime."
          >
            <CtaLink href="/products">Shop all products</CtaLink>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {orderedArtists.map((artist, index) => (
              <Reveal key={artist.handle} delay={Math.min(index * 0.1, 0.4)}>
                <Link
                  href={`/artist/${artist.handle}`}
                  className="group block relative overflow-hidden bg-surface-card border border-border-default hover:border-accent transition-colors duration-500"
                >
                  {/* Artist Image */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-surface-raised">
                    {artist.heroImage && (
                      <Image
                        src={artist.heroImage}
                        alt={artist.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
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
                      style={{ color: artist.accentColor || 'var(--accent)' }}
                    />
                  </div>

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: artist.accentColor || 'var(--accent)' }}
                      />
                      <span className="font-accent text-xs tracking-[0.15em] text-text-on-media-muted">
                        {artist.tagline || 'Fan Collection'}
                      </span>
                    </div>
                    <h2 className="font-display text-2xl md:text-3xl text-text-on-media mb-3">
                      {artist.name}
                    </h2>
                    <p className="font-body text-sm text-text-on-media-muted line-clamp-2 mb-4">
                      {artist.bio || `Shop exclusive ${artist.name} merchandise.`}
                    </p>

                    {/* Product Count Badge */}
                    {artist.productCount ? (
                      <div className="mb-3">
                        <span
                          className="inline-flex items-center px-2 py-1 text-xs font-accent tracking-wider"
                          style={{
                            backgroundColor: 'var(--brand-veil)',
                            color: 'var(--text-on-media)',
                          }}
                        >
                          {artist.productCount} PRODUCTS
                        </span>
                      </div>
                    ) : null}

                    {/* CTA */}
                    <div className="flex items-center gap-2 text-sm font-accent tracking-wider">
                      <span
                        className="transition-colors duration-300"
                        style={{ color: artist.accentColor }}
                      >
                        SHOP COLLECTION
                      </span>
                      <ArrowRight
                        size={16}
                        aria-hidden="true"
                        className="transition-transform duration-300 group-hover:translate-x-1"
                        style={{ color: artist.accentColor }}
                      />
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </Container>

      {/* Newsletter CTA */}
      <Container as="section" className="pb-24">
        <div className="relative bg-surface-card border border-border-default p-12 md:p-16 text-center overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5" aria-hidden="true">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-4xl text-text-primary mb-4">
              More Artists Coming Soon
            </h2>
            <p className="font-body text-text-muted max-w-lg mx-auto mb-8">
              Be the first to know when we add new artists to our collection.
              Join our community for exclusive drops and early access.
            </p>
            <CtaLink href="/products">
              EXPLORE ALL PRODUCTS
              <ArrowRight size={16} aria-hidden="true" />
            </CtaLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
