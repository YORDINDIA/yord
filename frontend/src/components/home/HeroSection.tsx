'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SplitText } from '@/components/ui/SplitText';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);

  // Track mouse position for cursor-reactive gradient
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative h-screen min-h-[700px] overflow-hidden"
    >
      {/* Background Video/Image with Parallax */}
      <motion.div
        className="absolute inset-0"
        style={{ y, scale }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-noir-950/40 via-noir-950/20 to-noir-950 z-10" />

        {/* Subtle Noise Texture */}
        <div
          className="absolute inset-0 z-[11] pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Enhanced Animated Gradient Mesh Background */}
        <div className="absolute inset-0 bg-noir-950">
          <div className="absolute inset-0 opacity-40">
            {/* Primary Gold Orb - larger, more prominent */}
            <div
              className="absolute w-[800px] h-[800px] blur-[150px] animate-float animate-liquid-morph"
              style={{
                top: '10%',
                left: '20%',
                background: 'radial-gradient(circle, rgba(255,217,102,0.3) 0%, transparent 70%)',
                animationDuration: '8s',
              }}
            />
            {/* Secondary Purple Orb */}
            <div
              className="absolute w-[600px] h-[600px] blur-[120px] animate-float animate-liquid-morph"
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
              className="absolute w-[500px] h-[500px] blur-[100px] animate-float animate-liquid-morph"
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

        {/* Sparkle Particles */}
        <div className="absolute inset-0 pointer-events-none z-[4]">
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

        {/* Cursor-Reactive Gradient */}
        <div
          className="absolute inset-0 pointer-events-none z-[5] transition-opacity duration-500"
          style={{
            background: `radial-gradient(
              800px circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%,
              rgba(255, 217, 102, 0.08) 0%,
              transparent 50%
            )`,
          }}
        />
      </motion.div>

      {/* Content - Grid Layout to prevent overlap */}
      <motion.div
        className="relative z-20 h-full grid grid-rows-[1fr_auto_auto] px-6"
        style={{ opacity }}
      >
        {/* Zone 1: Main Content - vertically centered */}
        <div className="flex flex-col items-center justify-center text-center pt-20">
          {/* Animated Diamond Ornament */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-6"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto">
              <motion.path
                d="M12 2L22 12L12 22L2 12L12 2Z"
                stroke="var(--gold-200)"
                strokeWidth="1"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.3 }}
              />
              <motion.path
                d="M12 6L18 12L12 18L6 12L12 6Z"
                stroke="var(--gold-200)"
                strokeWidth="0.5"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.5 }}
                transition={{ duration: 1.2, delay: 0.6 }}
              />
            </svg>
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.3em] text-gold-200 mb-6"
          >
            LUXURY CONCERT FASHION
          </motion.p>

          {/* Main Headline with Split Text Animation */}
          <h1 className="display-text text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-ivory-50 mb-6 max-w-5xl">
            <span className="block overflow-hidden">
              <SplitText text="Where Music" delay={0.4} />
            </span>
            <span className="block overflow-hidden relative">
              <span className="gold-text-animated">
                <SplitText text="Meets Luxury" delay={0.7} />
              </span>
            </span>
          </h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="font-[family-name:var(--font-cormorant)] text-xl md:text-2xl text-ivory-200 max-w-2xl mb-10"
          >
            Premium artist merchandise and concert couture for devoted fans.
            Coldplay. Taylor Swift. Diljit Dosanjh. And more.
          </motion.p>

          {/* CTA Buttons with Enhanced Hover Effects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="relative group"
            >
              <Link href="/collections">
                <Button variant="gold" size="lg" data-cursor="pointer" className="relative z-10">
                  SHOP COLLECTIONS
                </Button>
              </Link>
              {/* Gold glow on hover */}
              <div className="absolute inset-0 bg-gold-200/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 rounded-sm" />
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link href="/artists">
                <Button variant="secondary" size="lg" data-cursor="pointer">
                  EXPLORE ARTISTS
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Zone 2: Stats Bar with Premium Styling */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="flex justify-center py-6"
        >
          <div className="relative max-w-3xl w-full stats-premium-border">
            <div className="glass py-5 px-8 flex items-center justify-center gap-8 sm:gap-16">
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-gold-200 group-hover:text-gold-100 transition-colors">
                  <AnimatedCounter value={50000} formatAbbreviated suffix="+" />
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-ivory-400 mt-1">HAPPY FANS</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-gold-200 group-hover:text-gold-100 transition-colors">
                  <AnimatedCounter value={127} />
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-ivory-400 mt-1">COUNTRIES</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-gold-200 group-hover:text-gold-100 transition-colors">
                  <AnimatedCounter value={15} suffix="+" />
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-ivory-400 mt-1">ARTISTS</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Zone 3: Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="flex justify-center pb-8"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-2 text-ivory-400 scroll-indicator-line cursor-pointer group"
          >
            <span className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] group-hover:text-gold-200 transition-colors">
              SCROLL
            </span>
            <ChevronDown size={20} className="group-hover:text-gold-200 transition-colors animate-gold-breath" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
