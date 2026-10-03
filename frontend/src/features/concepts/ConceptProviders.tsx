'use client';

import { MotionConfig } from 'framer-motion';

/* Scoped to /concepts/* only: the original page keeps its current motion
   behaviour, concepts honour prefers-reduced-motion for framer-motion too. */
export function ConceptProviders({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
