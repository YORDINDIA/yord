'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Instagram, Youtube, Twitter, Loader2, CheckCircle } from 'lucide-react';
import { ARTISTS } from '@yord/db-types';

const FOOTER_LINKS = {
  shop: [
    { label: 'New Arrivals', href: '/collection/new-arrivals' },
    { label: 'Bestsellers', href: '/collection/bestsellers' },
    { label: 'Limited Editions', href: '/collection/limited-edition' },
    { label: 'All Products', href: '/products' },
    { label: 'Concert Merchandise', href: '/concert-merchandise-india' },
  ],
  concerts: [
    { label: 'All Concerts', href: '/concerts' },
    { label: 'Mumbai Concerts', href: '/concerts/city/mumbai' },
    { label: 'Delhi Concerts', href: '/concerts/city/delhi' },
    { label: 'Bengaluru Concerts', href: '/concerts/city/bengaluru' },
    { label: 'Pune Concerts', href: '/concerts/city/pune' },
  ],
  support: [
    { label: 'Contact Us', href: '/contact' },
    { label: 'Shipping Info', href: '/shipping' },
    { label: 'Returns & Exchanges', href: '/returns' },
    { label: 'Size Guide', href: '/size-guide' },
    { label: 'FAQs', href: '/faq' },
    { label: 'Track Order', href: '/track-order' },
  ],
  company: [
    { label: 'Our Story', href: '/about' },
    { label: 'Blog', href: '/blog' },
  ],
};

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com/yordindia', icon: Instagram },
  { label: 'YouTube', href: 'https://youtube.com/@yordindia', icon: Youtube },
  { label: 'Twitter', href: 'https://twitter.com/yordindia', icon: Twitter },
];

export function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <footer className="bg-surface-page border-t border-border-default">
      {/* Main Footer */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center mb-6 group">
              <span
                className="font-[family-name:var(--font-playfair)] text-3xl font-bold"
                style={{
                  // On the page surface (not over media), so the light theme
                  // reverses to ink→bronze; an ivory start would be invisible.
                  background:
                    'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-on-surface) 45%, var(--text-primary) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                YORD
              </span>
              <span className="mx-2 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
                  <path d="M3 0L6 3L3 6L0 3L3 0Z" fill="var(--accent-on-surface)" />
                </svg>
              </span>
              <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-accent group-hover:text-accent-hover transition-colors duration-300">
                INDIA
              </span>
            </Link>
            <p className="font-[family-name:var(--font-cormorant)] text-xl text-text-secondary mb-6 max-w-sm">
              Where Music Meets Luxury. Premium concert couture for the devoted fan.
            </p>

            {/* Newsletter */}
            <div className="space-y-4">
              <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted">
                JOIN THE INNER CIRCLE
              </p>
              {status === 'success' ? (
                <div className="flex items-center gap-2 py-3 text-success">
                  <CheckCircle size={16} />
                  <span className="font-[family-name:var(--font-jakarta)] text-sm">
                    Thanks for subscribing!
                  </span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 bg-surface-card border border-border-strong text-text-primary px-4 py-3 text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                    disabled={status === 'loading'}
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="bg-accent text-text-on-accent px-6 py-3 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    {status === 'loading' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      'SUBSCRIBE'
                    )}
                  </button>
                </form>
              )}
              <p className="text-xs text-text-muted">
                Early access to drops. Exclusive offers. No spam.
              </p>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-2">
            <h4 className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-6">
              SHOP
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.shop.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-[family-name:var(--font-jakarta)] text-sm text-text-secondary hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-6">
              CONCERTS
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.concerts.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-[family-name:var(--font-jakarta)] text-sm text-text-secondary hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-6">
              SUPPORT
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.support.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-[family-name:var(--font-jakarta)] text-sm text-text-secondary hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-6">
              COMPANY
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-[family-name:var(--font-jakarta)] text-sm text-text-secondary hover:text-accent transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Artists Column */}
          <div className="lg:col-span-2">
            <h4 className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-6">
              ARTISTS
            </h4>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {Object.values(ARTISTS).slice(0, 6).map((artist) => (
                <li key={artist.handle}>
                  <Link
                    href={`/artist/${artist.handle}`}
                    className="flex items-center gap-2 font-[family-name:var(--font-jakarta)] text-sm text-text-secondary hover:text-accent transition-colors group"
                  >
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
                  className="flex items-center gap-2 font-[family-name:var(--font-jakarta)] text-sm text-accent hover:text-accent-hover transition-colors group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform" />
                  View All Artists →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border-default">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Copyright */}
            <p suppressHydrationWarning className="font-[family-name:var(--font-jakarta)] text-xs text-text-muted text-center md:text-left">
              &copy; {new Date().getFullYear()} YORD India. All rights reserved.
            </p>

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
                  <social.icon size={20} />
                </a>
              ))}
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-muted">
              <Link href="/privacy" className="hover:text-accent transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-accent transition-colors">
                Terms of Service
              </Link>
              <Link href="/cookies" className="hover:text-accent transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
