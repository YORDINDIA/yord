'use client';

import { cn } from '@yord/ui';
import { sanitizeHtml } from '@/lib/sanitize';
import { Reveal } from '@/features/ui/Reveal';

interface ProductDescriptionProps {
  /** `body_html` from the products row, already admin-sanitized on save. */
  html: string;
  className?: string;
}

/**
 * Long-form product copy, split out of `ProductInfo` so the purchase column can
 * stay short enough for its sticky rail to actually have travel (a rail as tall
 * as the gallery cannot stick anywhere).
 *
 * The styles are written against the semantic tokens instead of Tailwind's
 * `prose` modifiers: `prose-invert` hardcodes dark-theme ink, and light is the
 * storefront's default theme, so every `<p>`/`<strong>`/`<a>` inside the body
 * rendered as light-on-light. Sanitized at render as well as on save — the
 * admin's AI preview and this both inject it with `dangerouslySetInnerHTML`.
 */
export function ProductDescription({ html, className }: ProductDescriptionProps) {
  if (!html) return null;

  return (
    <Reveal className={className}>
      <h2 className="font-accent text-sm tracking-[0.15em] text-text-muted mb-4">DESCRIPTION</h2>
      <div
        className={cn(
          'font-body text-sm leading-relaxed text-text-muted space-y-4',
          '[&_h2]:font-display [&_h2]:text-lg [&_h2]:text-text-primary [&_h2]:mt-8 [&_h2]:mb-2',
          '[&_h3]:font-display [&_h3]:text-lg [&_h3]:text-text-primary [&_h3]:mt-8 [&_h3]:mb-2',
          '[&_h4]:font-accent [&_h4]:text-xs [&_h4]:tracking-[0.1em] [&_h4]:text-text-muted [&_h4]:mt-6 [&_h4]:mb-2',
          '[&_strong]:text-text-secondary [&_strong]:font-semibold',
          '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-accent-hover',
          '[&_ul]:list-none [&_ul]:pl-0 [&_ul]:space-y-2',
          '[&_li]:flex [&_li]:items-start [&_li]:gap-2',
          "[&_li]:before:content-[''] [&_li]:before:w-1.5 [&_li]:before:h-1.5 [&_li]:before:mt-[0.45em]",
          '[&_li]:before:shrink-0 [&_li]:before:rounded-full [&_li]:before:bg-accent'
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    </Reveal>
  );
}
