'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Star, Shield, Truck, Heart } from 'lucide-react';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';

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

function AnimatedCorner({ position, isInView }: { position: 'tl' | 'tr' | 'bl' | 'br'; isInView: boolean }) {
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
      <motion.path
        d={paths[position]}
        stroke="var(--gold-200)"
        strokeWidth="2"
        strokeLinecap="square"
        initial={{ pathLength: 0 }}
        animate={isInView ? { pathLength: 1 } : {}}
        transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export function BrandStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const yLeft = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const yRight = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <section ref={containerRef} className="relative py-32 overflow-hidden">
      {/* Background with Parallax */}
      <motion.div
        className="absolute inset-0 bg-noir-950"
        style={{ y }}
      >
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 -left-32 w-[400px] h-[400px] rounded-full bg-gold-200/5 blur-[100px] animate-liquid-morph" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px] animate-liquid-morph" style={{ animationDelay: '4s' }} />
      </motion.div>

      {/* Gold Accent Lines */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-200/30 to-transparent" />
      <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-200/30 to-transparent" />

      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column - Story with parallax offset */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            style={{ y: yLeft }}
          >
            <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-gold-200 mb-4">
              THE YORD STORY
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6 leading-tight">
              More Than
              <br />
              <span className="gold-text animate-shimmer-sweep">Merchandise</span>
            </h2>
            <div className="space-y-6 text-lg text-ivory-200 font-[family-name:var(--font-cormorant)]">
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8"
            >
              <Link
                href="/about"
                className="inline-flex items-center gap-3 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] text-gold-200 hover:text-gold-300 transition-colors group"
                data-cursor="pointer"
              >
                DISCOVER OUR STORY
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Column - Visual Element with parallax offset */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
            style={{ y: yRight }}
          >
            {/* Decorative Frame with Animated Corners */}
            <div className="relative aspect-[4/5] border border-noir-700 p-8 lg:p-12">
              {/* Animated Corner Accents */}
              <AnimatedCorner position="tl" isInView={isInView} />
              <AnimatedCorner position="tr" isInView={isInView} />
              <AnimatedCorner position="bl" isInView={isInView} />
              <AnimatedCorner position="br" isInView={isInView} />

              {/* Content */}
              <div className="h-full flex flex-col justify-center items-center text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                  animate={isInView ? { scale: 1, opacity: 1, rotate: 0 } : {}}
                  transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-8"
                >
                  <span className="font-[family-name:var(--font-playfair)] text-8xl lg:text-9xl font-bold gold-text animate-shimmer-sweep">
                    Y
                  </span>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.8 }}
                  className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.4em] text-ivory-400 mb-4"
                >
                  ESTABLISHED 2024
                </motion.p>

                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.9 }}
                  className="font-[family-name:var(--font-cormorant)] text-2xl text-ivory-50 mb-6 italic"
                >
                  &quot;Where Every Thread Tells a Story&quot;
                </motion.h3>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 1 }}
                  className="flex items-center gap-6 text-ivory-400"
                >
                  <div className="text-center">
                    <p className="font-[family-name:var(--font-playfair)] text-3xl text-gold-200">
                      <AnimatedCounter value={50000} formatAbbreviated suffix="+" />
                    </p>
                    <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em]">FANS SERVED</p>
                  </div>
                  <div className="w-px h-12 bg-noir-700" />
                  <div className="text-center">
                    <p className="font-[family-name:var(--font-playfair)] text-3xl text-gold-200">
                      <AnimatedCounter value={15} suffix="+" />
                    </p>
                    <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em]">ARTISTS</p>
                  </div>
                  <div className="w-px h-12 bg-noir-700" />
                  <div className="text-center">
                    <p className="font-[family-name:var(--font-playfair)] text-3xl text-gold-200">
                      <AnimatedCounter value={500} suffix="+" />
                    </p>
                    <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em]">PRODUCTS</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Brand Values with hover glow */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {BRAND_VALUES.map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
              className="text-center group"
              whileHover={{ scale: 1.02 }}
            >
              <motion.div
                className="inline-flex items-center justify-center w-16 h-16 mb-6 border border-noir-700 transition-all duration-300 group-hover:border-gold-200/50"
                whileHover={{
                  boxShadow: '0 0 30px rgba(255, 217, 102, 0.3)',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                >
                  <value.icon size={24} className="text-gold-200" />
                </motion.div>
              </motion.div>
              <h4 className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.1em] text-ivory-50 mb-2">
                {value.title}
              </h4>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                {value.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
