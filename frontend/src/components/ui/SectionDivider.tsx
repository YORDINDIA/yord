'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface SectionDividerProps {
  variant?: 'line' | 'ornament' | 'gradient';
  className?: string;
}

export function SectionDivider({ variant = 'line', className = '' }: SectionDividerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  if (variant === 'line') {
    return (
      <div ref={ref} className={`relative h-px overflow-hidden ${className}`}>
        <motion.div
          className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-transparent via-gold-200/50 to-transparent"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    );
  }

  if (variant === 'ornament') {
    return (
      <div ref={ref} className={`relative py-8 flex items-center justify-center ${className}`}>
        {/* Left Line */}
        <motion.div
          className="absolute left-0 right-1/2 h-px bg-gradient-to-r from-transparent to-gold-200/30 mr-8"
          initial={{ scaleX: 0, originX: 1 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Center Ornament */}
        <motion.div
          className="relative z-10 w-12 h-12 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Diamond shape */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gold-200">
            <motion.path
              d="M12 2L22 12L12 22L2 12L12 2Z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={isInView ? { pathLength: 1 } : {}}
              transition={{ duration: 1, delay: 0.6 }}
            />
          </svg>
        </motion.div>

        {/* Right Line */}
        <motion.div
          className="absolute left-1/2 right-0 h-px bg-gradient-to-l from-transparent to-gold-200/30 ml-8"
          initial={{ scaleX: 0, originX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    );
  }

  if (variant === 'gradient') {
    return (
      <div ref={ref} className={`relative h-24 overflow-hidden ${className}`}>
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-noir-950 via-noir-900 to-noir-950"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
        />
        {/* Subtle gold glow in center */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 0.3 }}
        >
          <div className="w-64 h-1 bg-gradient-to-r from-transparent via-gold-200/20 to-transparent blur-sm" />
        </motion.div>
      </div>
    );
  }

  return null;
}
