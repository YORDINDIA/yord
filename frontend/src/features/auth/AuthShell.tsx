import { cn } from '@yord/ui';
import type { ReactNode } from 'react';
import { FormBanner } from '@/features/ui/FormBanner';

export interface AuthShellProps {
  /** The page's real `h1`. The brand mark above it is a `<span>`, not a heading. */
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Links below the card (already logged in? create one? terms?). */
  footer?: ReactNode;
  /** Success/expired-link views centre their icon above the title. */
  icon?: ReactNode;
  className?: string;
}

/**
 * The one auth card. Login, register, forgot-password and reset-password all
 * rendered their own `min-h-screen` frame and card; they now render this inside
 * the `(auth)` layout, so the frame (gutter, width, brand) is defined once and
 * the four pages differ only in title, fields and footer.
 *
 * The title is the `h1` on purpose: the brand line above the card is a link,
 * not a heading, so the page outline starts at the form.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  icon,
  className,
}: AuthShellProps) {
  return (
    <section className={cn('bg-surface-card border border-border-default p-8', className)}>
      {icon ? <div className="mb-6 flex justify-center">{icon}</div> : null}
      <h1 className="font-display text-2xl text-text-primary text-center">{title}</h1>
      {description ? (
        <p className="font-body text-sm text-text-muted text-center mt-2 mb-6">{description}</p>
      ) : null}
      {children}
      {footer ? (
        <div className="mt-6 text-center font-body text-sm text-text-muted">{footer}</div>
      ) : null}
    </section>
  );
}

export interface AuthNoticeProps {
  /** `error` is `role="alert"`; `success` is `role="status"`. */
  tone?: 'error' | 'success';
  children: ReactNode;
  className?: string;
}

/**
 * Form-level feedback banner. `Field` announces per-field errors itself; this
 * is for the failures that belong to no single field (bad credentials, a
 * failed OAuth redirect, an unreachable backend).
 *
 * A thin adapter over the shared `FormBanner`, not a second implementation: it
 * renames the tone (`error` → `danger`, the primitive's status colour) and
 * supplies the auth/account forms' `mb-6`. The named export survives because
 * nine call sites across five auth/account files read better as "the auth
 * notice" than as a tone-mapped generic banner.
 */
export function AuthNotice({ tone = 'error', children, className }: AuthNoticeProps) {
  return (
    <FormBanner tone={tone === 'error' ? 'danger' : 'success'} className={cn('mb-6', className)}>
      {children}
    </FormBanner>
  );
}

/** Centred icon badge for the success / expired-link states. */
export function AuthStateIcon({
  tone = 'success',
  children,
}: {
  tone?: 'success' | 'danger' | 'accent';
  children: ReactNode;
}) {
  return (
    <div
      // The badge repeats the heading below it, so it is decoration to a
      // screen reader rather than a second announcement of the same state.
      aria-hidden="true"
      className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center',
        tone === 'success' && 'bg-success/10 text-success',
        tone === 'danger' && 'bg-danger/10 text-danger',
        tone === 'accent' && 'bg-accent-tint text-accent'
      )}
    >
      {children}
    </div>
  );
}
