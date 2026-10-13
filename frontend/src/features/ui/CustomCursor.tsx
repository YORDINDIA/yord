'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

const FINE_POINTER = '(pointer: fine)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * The custom cursor: a dot that tracks the pointer exactly and a ring that
 * follows it on a spring.
 *
 * Trimmed from the version that shipped, which cost far more than it returned:
 *
 * 1. `* { cursor: none !important }` removed the native cursor from text inputs
 *    and textareas too, so the caret affordance was gone. The rule is now
 *    scoped to everything *except* text fields.
 * 2. A document-wide `mouseover` listener called `closest()` on every hovered
 *    element and replaced the state object on every change — a React re-render
 *    per hover. Hover and press are CSS states now (`:has()` + `:active`), and
 *    the only React state left is "is the pointer in the window".
 * 3. The dot's box-shadow glow was dropped; it is a per-hover paint for very
 *    little visible effect. `mix-blend-difference` stays — the dot has to stay
 *    legible over the home hero's photograph, and it is one 8px element.
 *
 * The component still renders nothing at all without a fine pointer or with
 * reduced motion preferred, which is what leaves the native cursor intact for
 * both.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);

  // Exact position for the dot, spring physics for the ring.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const ringX = useSpring(mouseX, { damping: 25, stiffness: 400, mass: 0.5 });
  const ringY = useSpring(mouseY, { damping: 25, stiffness: 400, mass: 0.5 });

  // Positive `(pointer: fine)` detection (not touch heuristics) so hybrid
  // touchscreen laptops with a mouse keep it.
  useEffect(() => {
    const pointerQuery = window.matchMedia(FINE_POINTER);
    const motionQuery = window.matchMedia(REDUCED_MOTION);
    const sync = () => setEnabled(pointerQuery.matches && !motionQuery.matches);
    // In a frame rather than the effect body: this reads a browser-only value
    // after hydration, and setState-in-effect is a lint error here.
    const raf = requestAnimationFrame(sync);
    pointerQuery.addEventListener('change', sync);
    motionQuery.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(raf);
      pointerQuery.removeEventListener('change', sync);
      motionQuery.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Three listeners, not six. `mousemove` sets the motion values directly, so
    // there is no per-frame React render; `setVisible(true)` is a no-op bail-out
    // once it is already true.
    const handleMouseMove = (event: MouseEvent) => {
      mouseX.set(event.clientX);
      mouseY.set(event.clientY);
      setVisible(true);
    };
    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
    };
  }, [enabled, mouseX, mouseY]);

  if (!enabled) return null;

  return (
    <>
      <style jsx global>{`
        @media (pointer: fine) {
          /* Everything except text fields: the caret affordance on an input or
             a textarea has to survive a decorative cursor. */
          body *:not(input, textarea, select, [contenteditable='true']) {
            cursor: none !important;
          }
          input,
          textarea,
          select,
          [contenteditable='true'] {
            cursor: auto !important;
          }

          .cursor-dot-inner,
          .cursor-ring-inner {
            transition:
              transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
              background-color 200ms ease-out,
              border-color 200ms ease-out;
          }
          .cursor-ring-inner {
            border-color: color-mix(in srgb, var(--accent) 40%, transparent);
          }

          /* Hover and press are CSS states, so a hover change never re-renders
             React. The independent scale property (rather than a second
             transform) lets the press state compose with the hover state
             instead of overriding it. */
          body:has(a:hover, button:hover, [role='button']:hover, [data-cursor='pointer']:hover)
            .cursor-ring-inner {
            transform: scale(1.6);
            border-color: color-mix(in srgb, var(--accent) 80%, transparent);
            background-color: color-mix(in srgb, var(--accent) 10%, transparent);
          }
          body:has(a:hover, button:hover, [role='button']:hover, [data-cursor='pointer']:hover)
            .cursor-dot-inner {
            transform: scale(0);
          }
          body:active .cursor-dot-inner {
            scale: 0.8;
          }
        }
      `}</style>

      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 z-[9999] pointer-events-none"
        style={{ x: mouseX, y: mouseY }}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      >
        <span className="cursor-dot-inner block w-2 h-2 -ml-1 -mt-1 rounded-full bg-accent mix-blend-difference" />
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 z-[9998] pointer-events-none"
        style={{ x: ringX, y: ringY }}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <span className="cursor-ring-inner block w-10 h-10 -ml-5 -mt-5 rounded-full border" />
      </motion.div>
    </>
  );
}
