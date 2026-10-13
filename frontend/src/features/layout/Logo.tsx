import Link from 'next/link';
import { cn } from '@yord/ui';

export interface LogoProps {
  /** `media` sits on a dark hero (theme-invariant); `surface` follows the theme. */
  tone?: 'surface' | 'media';
  className?: string;
  /** The wordmark's type scale — the header and footer size it differently. */
  wordClassName?: string;
}

/**
 * The YORD wordmark: gradient text, the diamond separator and `INDIA`.
 *
 * Header and footer had drifted into two copies with different tone logic and a
 * different gradient property (the footer used the `background` shorthand,
 * which resets `background-clip` — React does not re-apply it when only the
 * gradient changes, leaving a solid block). One component, one property.
 *
 * Server-safe: no state, no effects.
 */
export function Logo({ tone = 'surface', className, wordClassName }: LogoProps) {
  const onMedia = tone === 'media';

  return (
    <Link href="/" className={cn('group inline-flex items-center', className)}>
      <span className="relative">
        <span
          className={cn('font-display font-bold tracking-tight', wordClassName ?? 'text-2xl lg:text-3xl')}
          style={{
            // Ivory→gold reads on the dark hero; on a light page an ivory start
            // would be invisible, so the light theme reverses to ink→bronze.
            // `backgroundImage`, not the `background` shorthand: the shorthand
            // resets `background-clip`, which React does not re-apply when only
            // the gradient changes.
            backgroundImage: onMedia
              ? 'linear-gradient(135deg, var(--text-on-media) 0%, var(--accent-on-media) 45%, var(--text-on-media) 100%)'
              : 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-on-surface) 45%, var(--text-primary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          YORD
        </span>

        {/* Underline on hover. Transform-only, so it composites rather than
            repaints; the blur glow this replaced was a per-hover paint of a
            full-width blurred layer for very little visible effect. */}
        <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-accent/0 via-accent to-accent/0 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center" />
      </span>

      <span className="mx-2 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
        <svg width="6" height="6" viewBox="0 0 6 6" fill="none" aria-hidden="true">
          <path
            d="M3 0L6 3L3 6L0 3L3 0Z"
            fill={onMedia ? 'var(--accent-on-media)' : 'var(--accent-on-surface)'}
          />
        </svg>
      </span>

      <span
        className={cn(
          'font-accent text-xs tracking-[0.2em] transition-colors duration-300',
          onMedia
            ? 'text-accent-on-media group-hover:text-text-on-media'
            : 'text-accent group-hover:text-accent-hover'
        )}
      >
        INDIA
      </span>
    </Link>
  );
}
