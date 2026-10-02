'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

/** A diagonal shaft of light that crosses a chapter boundary as the page scrolls. Transform only. */
export function LightSweep({ tone }: { tone: 'stage' | 'surface' }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(scrollYProgress, [0.22, 0.9], ['-120%', '620%']);

  return (
    <div ref={ref} className="sl-sweep" data-tone={tone} aria-hidden="true">
      <motion.div className="sl-sweep__beam" style={{ x, skewX: -24 }} />
    </div>
  );
}
