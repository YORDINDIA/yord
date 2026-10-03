'use client';

import clsx from 'clsx';
import type { ElementType, ReactNode } from 'react';
import { useReducedMotion } from '@/lib/reduced-motion';

export interface StarCardProps {
  /** Wrapper element. Defaults to a plain div. */
  as?: ElementType;
  className?: string;
  /**
   * Class for the inner surface. Pass the band's own class (for
   * example `hero-kpi`) so a framed band keeps its look instead
   * of sitting on the default card surface.
   */
  innerClassName?: string;
  /** Beam colour. Defaults to the section accent. */
  color?: string;
  /** One full beam orbit, in seconds. */
  speed?: number;
  /** Frame width in px — the beams sweep through this ring. */
  thickness?: number;
  radius?: number;
  /** Render the surface without the orbiting frame. */
  border?: boolean;
  children?: ReactNode;
  /** Forwarded to the wrapper (id, data-*, event handlers, ...). */
  [key: string]: unknown;
}

/**
 * The framed surface: a thin ring of the section accent with two
 * gradient beams slowly orbiting it. Reserved for the one surface
 * the page exists for (the dashboard's revenue band) — a frame is
 * a headline, not a default.
 *
 * The beams are CSS keyframes, so they cost nothing; they are not
 * rendered at all under `prefers-reduced-motion`, leaving a plain
 * framed surface.
 */
export default function StarCard({
  as,
  className,
  innerClassName,
  color = 'var(--accent-local, var(--accent))',
  speed = 7,
  thickness = 2,
  radius = 12,
  border = true,
  children,
  ...rest
}: StarCardProps) {
  const reduce = useReducedMotion();
  const Component = as ?? 'div';
  const beams = border && !reduce;
  // Reduced motion keeps the frame: the accent ring stands still
  // (a border in place of the padding the beams swept through) and
  // only the orbit is removed — `beams === false` alone would leave
  // zero padding on a frameless surface.
  const ring = border && !beams;

  return (
    <Component
      className={clsx('star-card', className)}
      style={{
        padding: beams ? `${thickness}px` : 0,
        ...(ring ? { border: `${thickness}px solid ${color}` } : null),
        borderRadius: radius,
      }}
      {...(rest as Record<string, unknown>)}
    >
      {beams && (
        <>
          <span
            className="star-card-beam star-card-beam--bottom"
            aria-hidden="true"
            style={{
              background: `radial-gradient(circle, ${color}, transparent 12%)`,
              animationDuration: `${speed}s`,
            }}
          />
          <span
            className="star-card-beam star-card-beam--top"
            aria-hidden="true"
            style={{
              background: `radial-gradient(circle, ${color}, transparent 12%)`,
              animationDuration: `${speed}s`,
            }}
          />
        </>
      )}
      <div
        className={clsx('star-card-inner', innerClassName)}
        style={{
          borderRadius: Math.max(
            radius - (beams || ring ? thickness : 0),
            0,
          ),
        }}
      >
        {children}
      </div>
    </Component>
  );
}
