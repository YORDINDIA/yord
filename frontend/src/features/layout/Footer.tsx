import Link from 'next/link';
import type { ArtistData } from '@yord/db-types';
import { Container } from '@/features/ui/Container';
import { Logo } from './Logo';
import { FooterColumn } from './FooterColumn';
import { NewsletterForm } from './NewsletterForm';
import { FOOTER_COLUMNS, LEGAL_LINKS, SOCIAL_LINKS } from './footerLinks';

/**
 * The storefront footer.
 *
 * A server component: the only interactive part is the newsletter sign-up,
 * which is its own client island (`NewsletterForm`). It used to be `'use client'`
 * for that form alone, which put every link, column and the social row into
 * every route's client bundle.
 *
 * Artist links come from the caller (`getArtistsWithMetadata()` in the `(main)`
 * layout), not the static `ARTISTS` record, so every link here resolves to a
 * real artist page. The static record's first six entries mixed published
 * artists with handles that have no collection at all.
 */
export function Footer({ artists }: { artists: ArtistData[] }) {
  return (
    <footer className="bg-surface-page border-t border-border-default">
      {/* Main Footer */}
      <Container className="py-16 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <Logo className="mb-6" wordClassName="text-3xl" />
            <p className="font-heading text-xl text-text-secondary mb-6 max-w-sm">
              Where Music Meets Luxury. Premium concert couture for the devoted fan.
            </p>

            <NewsletterForm />
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <FooterColumn key={column.title} title={column.title} links={column.links} />
          ))}

          {/* Artists Column */}
          <div className="lg:col-span-2">
            <h2 className="font-accent text-xs tracking-[0.2em] text-text-muted mb-6">ARTISTS</h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {artists.slice(0, 6).map((artist) => (
                <li key={artist.handle}>
                  <Link
                    href={`/artist/${artist.handle}`}
                    className="flex items-center gap-2 font-body text-sm text-text-secondary hover:text-accent transition-colors group"
                  >
                    {/* Brand colour as a mark, never as text: a brand yellow is
                        ~1.6:1 on the light page. */}
                    <span
                      className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-150"
                      style={{ backgroundColor: artist.accentColor }}
                    />
                    {artist.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/artists"
                  className="flex items-center gap-2 font-body text-sm text-accent hover:text-accent-hover transition-colors group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform" />
                  View All Artists →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Container>

      {/* Bottom Bar */}
      <div className="border-t border-border-default">
        <Container className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Copyright + the non-affiliation disclaimer. This line is
                load-bearing for Google: it stops the fan-made designs from
                reading as artist-endorsed merchandise. */}
            <div className="text-center md:text-left">
              <p className="font-body text-xs text-text-muted">
                &copy; {new Date().getFullYear()} YORD India. All rights reserved.
              </p>
              <p className="mt-1 font-body text-xs text-text-muted">
                Unofficial fan-made designs. Not affiliated with or endorsed by any artist.
              </p>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-accent transition-colors"
                  aria-label={social.label}
                >
                  <social.icon size={20} aria-hidden="true" />
                </a>
              ))}
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-muted">
              {LEGAL_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-accent transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
