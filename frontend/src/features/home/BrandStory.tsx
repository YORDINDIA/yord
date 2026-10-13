import Link from 'next/link';
import { ArrowRight, Star, Shield, Truck, Heart } from 'lucide-react';
import { AnimatedCounter } from '@/features/ui/AnimatedCounter';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { SECTION_PADDING_TALL } from './section';
import '@/features/ui/reveal.css';

const BRAND_VALUES = [
  {
    icon: Star,
    title: 'Premium Quality',
    description: 'Every piece crafted with the finest materials and attention to detail.',
  },
  {
    icon: Shield,
    title: 'Fan Made',
    description: 'Artist-inspired designs made by fans, for fans.',
  },
  {
    icon: Truck,
    title: 'Pan-India Delivery',
    description: 'Fast, secure shipping to every corner of the country.',
  },
  {
    icon: Heart,
    title: 'Fan-First',
    description: 'Designed by fans, for fans. Every purchase celebrates your passion.',
  },
];

function AnimatedCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const paths = {
    tl: 'M0 32 L0 0 L32 0',
    tr: 'M0 0 L32 0 L32 32',
    bl: 'M0 0 L0 32 L32 32',
    br: 'M32 0 L32 32 L0 32',
  };

  const positions = {
    tl: 'top-0 left-0',
    tr: 'top-0 right-0',
    bl: 'bottom-0 left-0',
    br: 'bottom-0 right-0',
  };

  return (
    <svg
      className={`absolute ${positions[position]} w-8 h-8`}
      viewBox="0 0 32 32"
      fill="none"
    >
      {/* Draws itself along the frame's scroll timeline (`.reveal-timeline` on
          the right column); `pathLength={1}` lets the dash cover the outline. */}
      <path
        className="reveal-draw"
        pathLength={1}
        d={paths[position]}
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * Brand story section.
 *
 * All entrances are scroll-driven CSS (`.reveal-*`); the former framer-motion
 * parallax is gone — it cost a scroll listener and a motion component per
 * layer for an effect that is invisible behind the section's own gradient.
 *
 * The gold `shimmerSweep` on the "Y" and on "Merchandise" is gone too: an
 * infinite `background-position` animation repaints the text layer on every
 * frame of a 4s loop, on the longest page in the app, for a shimmer that is
 * only visible when you stare at it.
 */
export function BrandStory() {
  return (
    <section className={`reveal-clip relative ${SECTION_PADDING_TALL}`}>
      {/* Background */}
      <div className="absolute inset-0 bg-surface-page">
        {/* Gradient Orbs — static. `animate-liquid-morph` animated
            `border-radius` on two blurred layers (100/120px), which repaints
            the blur every frame and is invisible under that much blur. */}
        <div className="absolute top-1/4 -left-32 w-[400px] h-[400px] rounded-full bg-accent-tint blur-[100px]" />
        {/* Was `bg-purple-500/5` — a raw palette step. There is no purple token,
            so the counterpoint orb is the accent tint at low strength. */}
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-accent-tint/40 blur-[120px]" />
      </div>

      {/* Gold Accent Lines */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="relative container-page">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column - Story */}
          <div className="reveal-left">
            <SectionHeading
              className="mb-6"
              eyebrow="THE YORD STORY"
              title={
                <>
                  More Than
                  <br />
                  <span className="gold-text">Merchandise</span>
                </>
              }
            />
            <div className="space-y-6 text-lg text-text-secondary font-heading">
              <p>
                YORD India was born from a simple belief: concert merchandise should be as
                memorable as the music itself. We craft premium apparel that captures the
                magic of live performances and transforms it into wearable art.
              </p>
              <p>
                From the electric energy of a Coldplay show to the poetic grace of Taylor Swift,
                from the vibrant celebration of Diljit Dosanjh—each piece tells a story of
                unforgettable moments shared between artists and their devoted fans.
              </p>
            </div>

            <div className="mt-8">
              <Link
                href="/about"
                className="inline-flex items-center gap-3 font-accent text-sm tracking-[0.15em] text-accent hover:text-accent-hover transition-colors group"
                data-cursor="pointer"
              >
                DISCOVER OUR STORY
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right Column - Visual Element */}
          <div className="reveal-right reveal-timeline relative">
            {/* Decorative Frame with Animated Corners */}
            <div className="relative aspect-[4/5] border border-border-default p-8 lg:p-12">
              {/* Animated Corner Accents */}
              <AnimatedCorner position="tl" />
              <AnimatedCorner position="tr" />
              <AnimatedCorner position="bl" />
              <AnimatedCorner position="br" />

              {/* Content */}
              <div className="h-full flex flex-col justify-center items-center text-center">
                <div className="reveal-scale mb-8">
                  <span className="font-display text-8xl lg:text-9xl font-bold gold-text">
                    Y
                  </span>
                </div>

                <p className="reveal-fade font-accent text-xs tracking-[0.4em] text-text-muted mb-4">
                  ESTABLISHED 2024
                </p>

                <h3 className="reveal-up font-heading text-2xl text-text-primary mb-6 italic">
                  &quot;Where Every Thread Tells a Story&quot;
                </h3>

                <div className="reveal-up flex items-center gap-6 text-text-muted">
                  <div className="text-center">
                    <p className="font-display text-3xl text-accent">
                      <AnimatedCounter value={50000} formatAbbreviated suffix="+" />
                    </p>
                    <p className="font-accent text-[10px] tracking-[0.2em]">FANS SERVED</p>
                  </div>
                  <div className="w-px h-12 bg-surface-inset" />
                  <div className="text-center">
                    <p className="font-display text-3xl text-accent">
                      <AnimatedCounter value={15} suffix="+" />
                    </p>
                    <p className="font-accent text-[10px] tracking-[0.2em]">ARTISTS</p>
                  </div>
                  <div className="w-px h-12 bg-surface-inset" />
                  <div className="text-center">
                    <p className="font-display text-3xl text-accent">
                      <AnimatedCounter value={500} suffix="+" />
                    </p>
                    <p className="font-accent text-[10px] tracking-[0.2em]">PRODUCTS</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Values with hover glow */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {BRAND_VALUES.map((value) => (
            <div
              key={value.title}
              className="reveal-up brand-value text-center group"
            >
              <div className="brand-value-icon inline-flex items-center justify-center w-16 h-16 mb-6 border border-border-default transition-all duration-300 group-hover:border-accent/50">
                <div className="brand-value-glyph">
                  <value.icon size={24} className="text-accent" />
                </div>
              </div>
              <h4 className="font-accent text-lg tracking-[0.1em] text-text-primary mb-2">
                {value.title}
              </h4>
              <p className="font-body text-sm text-text-muted">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
