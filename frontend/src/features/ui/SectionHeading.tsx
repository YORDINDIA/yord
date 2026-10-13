import { cn } from '@yord/ui';
import type { ReactNode } from 'react';

/**
 * Size per heading level. The two axes are separate on purpose: `as` is the
 * outline position a screen reader navigates by, `size` is how loud the title
 * looks. A homepage section and a policy section are both `h2`, but the
 * homepage is the brand showcase and is allowed to be larger.
 *
 * Every row's `md` is the exact class the level rendered before `size`
 * existed, so the default is a no-op.
 */
const HEADING_SIZE = {
  h1: {
    sm: 'text-3xl md:text-4xl',
    md: 'text-4xl md:text-5xl lg:text-6xl',
    lg: 'text-5xl md:text-6xl lg:text-7xl',
  },
  h2: {
    sm: 'text-2xl md:text-3xl',
    md: 'text-3xl md:text-4xl',
    lg: 'text-4xl md:text-5xl',
  },
  h3: {
    sm: 'text-xl md:text-2xl',
    md: 'text-2xl md:text-3xl',
    lg: 'text-3xl md:text-4xl',
  },
} as const;

export type SectionHeadingSize = keyof (typeof HEADING_SIZE)['h2'];

export interface SectionHeadingProps {
  /** Small accent label above the title. Rendered in Bebas, uppercased. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  as?: keyof typeof HEADING_SIZE;
  /** Visual weight of the title, independent of the heading level. `md` is
   *  what every section rendered before the prop existed. */
  size?: SectionHeadingSize;
  /** Rendered opposite the title (e.g. a "Shop all" link). Left-aligns only. */
  action?: ReactNode;
  /** Forwarded to the heading element, for `aria-labelledby` on the section. */
  id?: string;
  className?: string;
}

/**
 * The eyebrow + title + description block every section repeats. The heading
 * level is a prop because the same visual weight is an `h1` on a landing page
 * and an `h2` inside a section of it — and the level, not the size, is what a
 * screen reader navigates by. `size` then says how loud that level is drawn.
 *
 * For page surfaces only. Over a photo or video, use the on-media text tokens
 * directly: the title here is `text-text-primary`, which flips with the theme.
 *
 * Server-safe.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  as = 'h2',
  size = 'md',
  action,
  id,
  className,
}: SectionHeadingProps) {
  const Heading = as;
  const centered = align === 'center';

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        centered ? 'items-center text-center' : 'items-start',
        // The action sits beside the title on wide screens and stacks under it
        // on narrow ones, which is the layout every section already hand-rolled.
        action && 'sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className={cn('flex flex-col', centered && 'items-center')}>
        {eyebrow ? (
          <p className="font-accent text-xs uppercase tracking-[0.3em] text-accent mb-3">
            {eyebrow}
          </p>
        ) : null}
        {/* `text-balance` so a two-line title splits into even lines rather
            than leaving one word on the second. */}
        <Heading id={id} className={cn('font-display text-text-primary text-balance', HEADING_SIZE[as][size])}>
          {title}
        </Heading>
        {description ? (
          <p className="font-body text-sm md:text-base text-text-muted mt-3 max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
