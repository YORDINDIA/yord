'use client';

import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import { useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/reduced-motion';

export interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Colour of the cursor-following wash. Defaults to the section accent. */
  spotlightColor?: string;
  /** Turn the spotlight off (reduced motion, or a static surface). */
  spotlight?: boolean;
}

/**
 * The card surface with a cursor-tracked wash of the section
 * accent — the "this is the important card" treatment, used on
 * the dashboard's headline chart. Colour resolves through tokens
 * (`--accent-local-soft`), so it re-themes with the shell and
 * works in both themes.
 *
 * The wash is pure decoration: `pointer-events: none`, it fades
 * in on entry and disappears entirely under `prefers-reduced-motion`.
 */
export default function GlowCard({
  children,
  className,
  spotlightColor = 'var(--accent-local-soft, var(--accent-soft))',
  spotlight = true,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: GlowCardProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const enabled = spotlight && !reduce;

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    onMouseMove?.(event);
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  return (
    <div
      ref={ref}
      {...rest}
      className={clsx('glow-card', className)}
      onMouseMove={handleMove}
      onMouseEnter={(event) => {
        setActive(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setActive(false);
        onMouseLeave?.(event);
      }}
    >
      {enabled && (
        <span
          className="glow-card-spot"
          style={{
            opacity: active ? 1 : 0,
            background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 75%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
