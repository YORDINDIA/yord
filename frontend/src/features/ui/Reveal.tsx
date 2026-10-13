'use client';

import { createElement, useSyncExternalStore, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
} as const;

const PLAIN_TAGS = {
  div: 'div',
  section: 'section',
  article: 'article',
  li: 'li',
} as const;

/**
 * `false` on the server and during hydration, `true` afterwards.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: React uses the
 * server snapshot for the hydrating render and re-reads the client snapshot
 * once, so the two trees always agree and no setState is scheduled from an
 * effect body.
 */
const neverChanges = () => () => {};
const useHydrated = () => useSyncExternalStore(neverChanges, () => true, () => false);

export interface RevealProps {
  children: ReactNode;
  /** Seconds, matching framer-motion's `transition.delay`. */
  delay?: number;
  /** Start offset in px. */
  y?: number;
  className?: string;
  as?: keyof typeof MOTION_TAGS;
}

/**
 * One entrance animation, so the `initial={{ opacity: 0, y: 20 }}` /
 * `animate` / `transition={{ delay }}` triple is written once instead of at
 * every element of a section.
 *
 * Under `prefers-reduced-motion` it renders a plain element with no opacity
 * state at all — a fade from `opacity: 0` is a hidden content bug if anything
 * ever stops the animation (a paused tab, a stalled hydration, a future CSS
 * change), and "reduced" is not "slower".
 */
export function Reveal({ children, delay = 0, y = 20, className, as = 'div' }: RevealProps) {
  const hydrated = useHydrated();
  const reduceMotion = useReducedMotion();

  // The media query is only consulted after hydration: the server has none, so
  // branching on it during the first render would make the client's tree
  // disagree with the server's HTML and React would throw the subtree away.
  if (hydrated && reduceMotion) {
    return createElement(PLAIN_TAGS[as], { className }, children);
  }

  const Motion = MOTION_TAGS[as] as typeof motion.div;

  return (
    <Motion
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Motion>
  );
}
