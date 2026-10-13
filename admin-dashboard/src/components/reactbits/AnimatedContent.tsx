'use client';

import React, { useRef, useEffect } from 'react';
import { useReducedMotion } from '@/lib/reduced-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface AnimatedContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Scroll container; defaults to the window (the admin's shell
   *  scrolls the document, not an inner box). */
  container?: Element | string | null;
  /** Pixels the content rises before it settles. Admin density:
   *  a whisper, not a flight. */
  distance?: number;
  duration?: number;
  ease?: string;
  scale?: number;
  /** Fraction of the viewport at which the reveal starts. */
  threshold?: number;
  /**
   * Seconds before the reveal starts once triggered — gsap's
   * timeline delay, so `0.12` is 120ms, not `120`.
   */
  delay?: number;
  initialOpacity?: number;
  animateOpacity?: boolean;
  onComplete?: () => void;
}

/**
 * Scroll-reveal wrapper for dashboard sections.
 *
 * The wrapper starts `visibility: hidden` (`.animated-content`,
 * so the server HTML never flashes the destination layout) and
 * the effect moves it into place once it crosses the threshold.
 *
 * Reduced motion is handled in the stylesheet, not in JS: the
 * media query overrides the hidden class, so the content is
 * simply there — same markup on the server and the client, no
 * hydration mismatch, no reveal to skip.
 */
const AnimatedContent: React.FC<AnimatedContentProps> = ({
  children,
  container,
  distance = 18,
  duration = 0.55,
  ease = 'power3.out',
  scale = 1,
  threshold = 0.1,
  delay = 0,
  initialOpacity = 0,
  animateOpacity = true,
  onComplete,
  className = '',
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduce) {
      // The preference can resolve after the reveal was set up (the
      // hook's server snapshot is "no preference", so the first run
      // already wrote inline styles); clear only the animation
      // properties so the stylesheet — which shows the band plainly
      // under reduced motion — wins, and caller styles (layout,
      // custom properties) survive.
      gsap.set(el, { clearProps: 'transform,opacity,visibility' });
      return;
    }

    const scrollerTarget = container || null;
    const startPct = (1 - threshold) * 100;

    // Re-runs start from the previous run's inline styles; clear the
    // animation properties first so the measurement below is the
    // layout box, then capture the top BEFORE the initial transform
    // is written — the +y offset would push a band sitting just
    // above the start line below it and leave it hidden until a
    // later scroll.
    gsap.set(el, { clearProps: 'transform,opacity,visibility' });
    const layoutTop = el.getBoundingClientRect().top;

    // The fast-path start line comes from the viewport that actually
    // scrolls this element: against a custom scroller, the window
    // fold is meaningless (the band can sit far below the window yet
    // already be visible inside the container).
    const scrollerEl =
      typeof scrollerTarget === 'string'
        ? document.querySelector(scrollerTarget)
        : scrollerTarget;
    const scrollerRect = scrollerEl?.getBoundingClientRect();
    const startLine = scrollerRect
      ? scrollerRect.top + scrollerRect.height * (1 - threshold)
      : window.innerHeight * (1 - threshold);

    gsap.set(el, {
      y: distance,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: 'visible',
    });

    const tl = gsap
      .timeline({ paused: true, delay, onComplete: () => onComplete?.() })
      .to(el, { y: 0, scale: 1, opacity: 1, duration, ease });

    // Elements already inside the start line when this effect runs
    // (the dashboard paints entirely above the fold) are revealed
    // directly: ScrollTrigger does not fire `onEnter` for them on
    // the initial refresh, so a paused timeline wired only to
    // `onEnter` would leave the band invisible forever. Elements
    // still below the fold wait for the scroll, as intended.
    if (layoutTop < startLine) {
      tl.play();
      return () => {
        tl.kill();
      };
    }

    const st = ScrollTrigger.create({
      trigger: el,
      scroller: scrollerTarget || window,
      start: `top ${startPct}%`,
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      st.kill();
      tl.kill();
    };
  }, [
    container,
    distance,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    onComplete,
    reduce,
  ]);

  return (
    <div ref={ref} className={`animated-content ${className}`} {...props}>
      {children}
    </div>
  );
};

export default AnimatedContent;
