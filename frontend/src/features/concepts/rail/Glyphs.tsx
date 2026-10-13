/* House marks for the rail. One construction: 1.6 stroke, round caps and
   joins, the same bend as the steel rail and the hanger hook. */

const BASE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

/** The hanger: hook, neck, shoulders and the clip bar. */
export function Hanger({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 30" {...BASE}>
      <path d="M32 11.5V8.2a3.6 3.6 0 1 0-3.6-3.6" />
      <path d="M32 11.5C24 13.5 12 19 4.5 25.2H59.5C52 19 40 13.5 32 11.5Z" />
    </svg>
  );
}

export function Chevron({ dir, className }: { dir: 'prev' | 'next'; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" {...BASE}>
      <path d={dir === 'prev' ? 'M12.5 4.5L7 10l5.5 5.5' : 'M7.5 4.5L13 10l-5.5 5.5'} />
    </svg>
  );
}

export function Cross({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" {...BASE}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** Up-and-out arrow for links that leave the rail. */
export function ArrowOut({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" {...BASE}>
      <path d="M4 12L12 4M6 4h6v6" />
    </svg>
  );
}

/** Motion toggle: two bars while it moves, a hung stop when it is still. */
export function MotionMark({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" {...BASE}>
      {on ? <path d="M5.5 4v8M10.5 4v8" /> : <path d="M5 3.8l7 4.2-7 4.2Z" />}
    </svg>
  );
}
