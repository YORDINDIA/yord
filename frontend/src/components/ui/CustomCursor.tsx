'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';

interface CursorState {
  visible: boolean;
  clicked: boolean;
  hovered: boolean;
  text: string | null;
}

export function CustomCursor() {
  const [cursorState, setCursorState] = useState<CursorState>({
    visible: false,
    clicked: false,
    hovered: false,
    text: null,
  });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Use motion values for smooth cursor position
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring physics for the outer ring (follows with delay)
  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const ringX = useSpring(mouseX, springConfig);
  const ringY = useSpring(mouseY, springConfig);

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // Track mouse position
  useEffect(() => {
    if (isTouchDevice) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setCursorState((prev) => ({ ...prev, visible: true }));
    };

    const handleMouseLeave = () => {
      setCursorState((prev) => ({ ...prev, visible: false }));
    };

    const handleMouseEnter = () => {
      setCursorState((prev) => ({ ...prev, visible: true }));
    };

    const handleMouseDown = () => {
      setCursorState((prev) => ({ ...prev, clicked: true }));
    };

    const handleMouseUp = () => {
      setCursorState((prev) => ({ ...prev, clicked: false }));
    };

    // Handle hover states based on data-cursor attribute
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cursorType = target.closest('[data-cursor]')?.getAttribute('data-cursor');

      if (cursorType === 'pointer') {
        setCursorState((prev) => ({ ...prev, hovered: true, text: null }));
      } else if (cursorType?.startsWith('text:')) {
        setCursorState((prev) => ({ ...prev, hovered: true, text: cursorType.replace('text:', '') }));
      } else if (target.closest('a, button, [role="button"], input, textarea, select')) {
        setCursorState((prev) => ({ ...prev, hovered: true, text: null }));
      } else {
        setCursorState((prev) => ({ ...prev, hovered: false, text: null }));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseover', handleMouseOver);
    };
  }, [isTouchDevice, mouseX, mouseY]);

  // Don't render on touch devices
  if (isTouchDevice) return null;

  const { visible, clicked, hovered, text } = cursorState;

  return (
    <>
      {/* Hide default cursor */}
      <style jsx global>{`
        @media (pointer: fine) {
          * {
            cursor: none !important;
          }
        }
      `}</style>

      <AnimatePresence>
        {visible && (
          <>
            {/* Inner dot - follows immediately */}
            <motion.div
              className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
              style={{
                x: mouseX,
                y: mouseY,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: clicked ? 0.8 : hovered ? 0 : 1,
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div
                className="w-2 h-2 -ml-1 -mt-1 rounded-full bg-gold-200"
                style={{
                  boxShadow: '0 0 10px rgba(255, 217, 102, 0.5)',
                }}
              />
            </motion.div>

            {/* Outer ring - follows with spring physics */}
            <motion.div
              className="fixed top-0 left-0 pointer-events-none z-[9998]"
              style={{
                x: ringX,
                y: ringY,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: clicked ? 0.8 : 1,
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="flex items-center justify-center -ml-5 -mt-5"
                animate={{
                  width: hovered ? 64 : 40,
                  height: hovered ? 64 : 40,
                  marginLeft: hovered ? -32 : -20,
                  marginTop: hovered ? -32 : -20,
                }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  className="w-full h-full rounded-full border"
                  animate={{
                    borderColor: hovered ? 'rgba(255, 217, 102, 0.8)' : 'rgba(255, 217, 102, 0.4)',
                    backgroundColor: hovered ? 'rgba(255, 217, 102, 0.1)' : 'rgba(0, 0, 0, 0)',
                  }}
                  transition={{ duration: 0.2 }}
                />

                {/* Text label if present */}
                <AnimatePresence>
                  {text && (
                    <motion.span
                      className="absolute font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.1em] text-gold-200 whitespace-nowrap"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      {text}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
