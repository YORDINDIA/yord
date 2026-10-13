'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { CtaLink } from '@/features/ui/CtaLink';
import { AnimatedCounter } from '@/features/ui/AnimatedCounter';

/**
 * Home hero.
 *
 * Performance contract: the H1 is the LCP element, so it paints at opacity 1 in
 * the SSR HTML and its reveal is a CSS transform animation (`.hero-line`) — not
 * a hydration-time framer-motion stagger. Every other entrance is a CSS class
 * with `animation-fill-mode: both`, so nothing flashes in before it animates.
 * There is no scroll listener and no React state behind the cursor gradient:
 * the pointer position is written to `--hero-mx`/`--hero-my` on the section
 * through a ref, which is why this file no longer imports framer-motion.
 */
export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    // Pointer-fine only: a touch device has no cursor to react to.
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      el.style.setProperty(
        '--hero-mx',
        `${((e.clientX - rect.left) / rect.width) * 100}%`
      );
      el.style.setProperty(
        '--hero-my',
        `${((e.clientY - rect.top) / rect.height) * 100}%`
      );
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative h-screen min-h-[700px] overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0">
        {/* Gradient Overlay — the hero is full-bleed media and stays DARK in
            both themes, so this ends on the fixed scrim and never on the page
            surface: `to-surface-page` painted the light page colour under the
            ivory headline in light mode. */}
        <div className="absolute inset-0 bg-gradient-to-b from-scrim/40 via-scrim/20 to-scrim z-10" />

        {/* Enhanced Animated Gradient Mesh Background */}
        <div className="absolute inset-0 bg-scrim">
          <div className="absolute inset-0 opacity-40">
            {/* Primary Gold Orb - larger, more prominent */}
            <div
              className="hero-float absolute w-[800px] h-[800px] blur-[80px]"
              style={{
                top: '10%',
                left: '20%',
                background: 'radial-gradient(circle, rgba(255,217,102,0.3) 0%, transparent 70%)',
                animationDuration: '8s',
              }}
            />
            {/* Secondary Purple Orb */}
            <div
              className="hero-float absolute w-[600px] h-[600px] blur-[60px]"
              style={{
                bottom: '15%',
                right: '15%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                animationDelay: '2s',
                animationDuration: '10s',
              }}
            />
            {/* Accent Rose Orb */}
            <div
              className="hero-float absolute w-[500px] h-[500px] blur-[48px]"
              style={{
                top: '40%',
                right: '25%',
                background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
                animationDelay: '4s',
                animationDuration: '12s',
              }}
            />
          </div>
        </div>

        {/* Sparkle Particles — the twinkle only runs on desktop; the dots rest
            at opacity 0, so smaller viewports paint nothing. `hidden lg:block`
            keeps them out of the mobile DOM entirely: the CSS gate already
            stopped the animation, this stops the paint. */}
        <div className="absolute inset-0 pointer-events-none z-[4] hidden lg:block">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="hero-sparkle"
              style={{
                left: `${15 + i * 14}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </div>

        {/* Cursor-Reactive Gradient — position comes from --hero-mx/--hero-my */}
        <div className="hero-cursor-glow absolute inset-0 pointer-events-none z-[5]" />
      </div>

      {/* Content - Grid Layout to prevent overlap */}
      <div className="relative z-20 h-full grid grid-rows-[1fr_auto_auto] px-6">
        {/* Zone 1: Main Content - vertically centered */}
        <div className="flex flex-col items-center justify-center text-center pt-20">
          {/* Diamond Ornament */}
          <div className="hero-enter mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto">
              <path
                d="M12 2L22 12L12 22L2 12L12 2Z"
                stroke="var(--accent-on-media)"
                strokeWidth="1"
                fill="none"
              />
              <path
                d="M12 6L18 12L12 18L6 12L12 6Z"
                stroke="var(--accent-on-media)"
                strokeWidth="0.5"
                fill="none"
                opacity="0.5"
              />
            </svg>
          </div>

          {/* Tagline */}
          <p className="hero-enter hero-enter-1 font-accent text-sm tracking-[0.3em] text-accent-on-media mb-6">
            LUXURY CONCERT FASHION
          </p>

          {/* Main Headline — plain spans: the reveal is CSS-only and animates
              transform, while the text itself is opaque from the first paint.
              The gold line keeps `background-clip: text` on the outer span and
              the transform on the inner one, which is the shape the per-letter
              reveal used and the one that clips the gradient to the text box. */}
          <h1 className="display-text text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-text-on-media mb-6 max-w-5xl">
            <span className="block overflow-hidden">
              <span className="hero-line block">Where Music</span>
            </span>
            <span className="block overflow-hidden relative">
              <span className="gold-text-animated inline-block">
                <span className="hero-line hero-line-2 inline-block">
                  Meets Luxury
                </span>
              </span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="hero-enter hero-enter-2 font-heading text-xl md:text-2xl text-text-on-media-muted max-w-2xl mb-10">
            Premium artist merchandise and concert couture for devoted fans.
            Coldplay. Taylor Swift. Diljit Dosanjh. And more.
          </p>

          {/* CTA Buttons with Enhanced Hover Effects */}
          <div className="hero-enter hero-enter-3 flex flex-col sm:flex-row gap-4">
            <div className="relative group transition-transform duration-300 ease-out hover:scale-[1.02] hover:-translate-y-0.5">
              <CtaLink
                href="/collections"
                variant="gold"
                size="lg"
                data-cursor="pointer"
                className="relative z-10"
              >
                SHOP COLLECTIONS
              </CtaLink>
              {/* Gold glow on hover — on-media accent, so it stays gold over the
                  hero in light mode instead of turning into a pale page-coloured
                  blob. */}
              <div className="absolute inset-0 bg-accent-on-media/30 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 rounded-sm" />
            </div>

            <div className="transition-transform duration-300 ease-out hover:scale-[1.02] hover:-translate-y-0.5">
              <CtaLink
                href="/artists"
                variant="secondary"
                size="lg"
                data-cursor="pointer"
                className="text-text-on-media border-text-on-media hover:bg-text-on-media hover:text-scrim"
              >
                EXPLORE ARTISTS
              </CtaLink>
            </div>
          </div>
        </div>

        {/* Zone 2: Stats Bar with Premium Styling */}
        <div className="hero-enter hero-enter-4 flex justify-center py-6">
          <div className="relative max-w-3xl w-full stats-premium-border">
            {/* On-media panel, not `.glass`: the hero is dark in both themes, so
                the light theme's white glass would put a bright slab under the
                ivory stat labels. */}
            <div className="bg-scrim/60 backdrop-blur-md border border-white/10 py-5 px-8 flex items-center justify-center gap-8 sm:gap-16">
              <div className="text-center group cursor-default">
                <p className="font-display text-2xl sm:text-3xl text-accent-on-media group-hover:text-text-on-media transition-colors">
                  <AnimatedCounter value={50000} formatAbbreviated suffix="+" />
                </p>
                <p className="font-accent text-[10px] tracking-[0.2em] text-text-on-media-muted mt-1">HAPPY FANS</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-display text-2xl sm:text-3xl text-accent-on-media group-hover:text-text-on-media transition-colors">
                  <AnimatedCounter value={127} />
                </p>
                <p className="font-accent text-[10px] tracking-[0.2em] text-text-on-media-muted mt-1">COUNTRIES</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-display text-2xl sm:text-3xl text-accent-on-media group-hover:text-text-on-media transition-colors">
                  <AnimatedCounter value={15} suffix="+" />
                </p>
                <p className="font-accent text-[10px] tracking-[0.2em] text-text-on-media-muted mt-1">ARTISTS</p>
              </div>
            </div>
          </div>
        </div>

        {/* Zone 3: Scroll Indicator */}
        <div className="hero-enter hero-enter-5 flex justify-center pb-8">
          <div className="hero-bounce flex flex-col items-center gap-2 text-text-on-media-muted scroll-indicator-line cursor-pointer group">
            <span className="font-accent text-[10px] tracking-[0.2em] group-hover:text-accent-on-media transition-colors">
              SCROLL
            </span>
            <ChevronDown size={20} className="group-hover:text-accent-on-media transition-colors" />
          </div>
        </div>
      </div>
    </section>
  );
}
