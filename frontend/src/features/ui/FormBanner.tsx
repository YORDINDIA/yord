import { AlertCircle, Check, Info } from 'lucide-react';
import { cn } from '@yord/ui';
import type { ReactNode } from 'react';

export type FormBannerTone = 'success' | 'danger' | 'info';

const TONES: Record<FormBannerTone, string> = {
  success: 'bg-success/10 border-success/30 text-success',
  danger: 'bg-danger/10 border-danger/30 text-danger',
  // The informative tone is not a status: it is "check your spam folder" or
  // "your link has been sent", so it takes the brand tint rather than a third
  // status colour.
  info: 'bg-accent-tint border-accent/30 text-accent',
};

const ICONS = { success: Check, danger: AlertCircle, info: Info } as const;

export interface FormBannerProps {
  tone: FormBannerTone;
  children: ReactNode;
  className?: string;
}

/**
 * Form-level feedback banner: the failures and confirmations that belong to no
 * single field (`Field` announces per-field errors itself). It generalises the
 * copies that `AuthShell` and `ContactForm` each carried.
 *
 * `danger` is `role="alert"` so it interrupts; success and info are
 * `role="status"` so they are announced without cutting across whatever the
 * reader is doing.
 *
 * Spacing is the caller's: the two copies sat at different distances from
 * their forms (and one of them inside a `space-y-*` stack), so no margin is
 * baked in here — pass it through `className`.
 *
 * Children render inside a single `<p>`, so this holds one run of text. A banner
 * that needs a heading plus a body — `/checkout`'s "Payment failed" block — stays
 * hand-rolled rather than nesting a `<p>` in a `<p>`, which a browser would
 * silently split into two sibling elements.
 *
 * Server-safe.
 */
export function FormBanner({ tone, children, className }: FormBannerProps) {
  const Icon = ICONS[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'p-4 border flex items-start gap-3 font-body text-sm',
        TONES[tone],
        className
      )}
    >
      <Icon aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="min-w-0">{children}</p>
    </div>
  );
}
