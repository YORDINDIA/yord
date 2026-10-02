'use client';

import { useEffect, useState } from 'react';
import Aurora from './Aurora';
import { useReactBitsColors } from '@/lib/reactbits-theme';
import { useReducedMotion } from '@/lib/reduced-motion';

export interface AmbientAuroraProps {
  className?: string;
  /** Wave strength. The admin wants a whisper, not a light show. */
  amplitude?: number;
  /** Blend width of the waves. Higher is softer. */
  blend?: number;
}

/**
 * ReactBits' `Aurora` (a single fullscreen WebGL triangle) as the admin's
 * ambient background, themed from the live tokens: saffron, blue, and
 * emerald in the dark theme, their light-theme counterparts in light.
 *
 * Guardrails: not rendered at all under reduced motion, and the render loop
 * pauses while the tab is hidden — an always-on WebGL loop is pure GPU spend
 * on a long-lived ops surface.
 */
export default function AmbientAurora({
  className,
  amplitude = 0.42,
  blend = 0.82,
}: AmbientAuroraProps) {
  const reduce = useReducedMotion();
  const colors = useReactBitsColors();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduce) return;
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [reduce]);

  if (reduce || !visible) return null;

  return (
    <div className={className} aria-hidden="true">
      <Aurora
        colorStops={[colors.accent, colors.blue, colors.emerald]}
        amplitude={amplitude}
        blend={blend}
      />
    </div>
  );
}
