import { cn } from '@yord/ui';
// The canonical reveal stylesheet lives beside this component: importing it
// from `features/home` made the home slice impossible to remove without
// breaking every section boundary on the site.
import './reveal.css';

interface SectionDividerProps {
  variant?: 'line' | 'ornament' | 'gradient';
  className?: string;
}

/**
 * Decorative section rule.
 *
 * Deliberately a server component: the line/ornament reveal is a scroll-driven
 * CSS animation (`.reveal-timeline` sets a view timeline, the bars and the
 * diamond reference it), so the divider renders identically with JS disabled
 * and no longer hydrates a motion component at every section boundary.
 *
 * The reveal is opt-in — `reveal.css` keeps every hidden state inside
 * `@supports (animation-timeline: view())`, so a browser without scroll-driven
 * animations paints the plain rule instead of nothing.
 */
export function SectionDivider({ variant = 'line', className }: SectionDividerProps) {
  if (variant === 'line') {
    return (
      <div className={cn('reveal-timeline relative h-px overflow-hidden', className)}>
        <div className="reveal-bar absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      </div>
    );
  }

  if (variant === 'ornament') {
    return (
      <div className={cn('reveal-timeline relative py-8 flex items-center justify-center', className)}>
        {/* Left Line */}
        <div className="reveal-bar reveal-bar--from-right absolute left-0 right-1/2 h-px bg-gradient-to-r from-transparent to-accent/30 mr-8" />

        {/* Center Ornament */}
        <div className="reveal-ornament relative z-10 w-12 h-12 flex items-center justify-center">
          {/* Diamond shape */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path
              className="reveal-draw"
              pathLength={1}
              d="M12 2L22 12L12 22L2 12L12 2Z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </div>

        {/* Right Line */}
        <div className="reveal-bar reveal-bar--from-left absolute left-1/2 right-0 h-px bg-gradient-to-l from-transparent to-accent/30 ml-8" />
      </div>
    );
  }

  if (variant === 'gradient') {
    return (
      <div className={cn('reveal-timeline relative h-24 overflow-hidden', className)}>
        <div className="reveal-soft absolute inset-0 bg-gradient-to-b from-surface-page via-surface-card to-surface-page" />
        {/* Subtle gold glow in center */}
        <div className="reveal-soft reveal-soft--late absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-1 bg-gradient-to-r from-transparent via-accent/20 to-transparent blur-sm" />
        </div>
      </div>
    );
  }

  return null;
}
