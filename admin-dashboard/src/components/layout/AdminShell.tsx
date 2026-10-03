import ShellScope from './ShellScope';

/**
 * The admin shell, rendered by `(admin)/layout.tsx` after the auth gate.
 *
 * A server component on purpose: it takes the badge counts (read server-side)
 * and the signed-in email, then hands the interactive parts to `ShellScope`.
 *
 * `title` is accepted for compatibility but not rendered — each page's own
 * `PageHeader` owns the visible title, and the topbar shows breadcrumbs only.
 */
export default function AdminShell({
  email,
  badges,
  children,
}: {
  /** Accepted for compatibility; the page's `PageHeader` renders the title. */
  title?: string;
  email: string | null;
  badges: { fulfillmentQueue: number; lowStock: number };
  children: React.ReactNode;
}) {
  return (
    <ShellScope badges={badges} email={email}>
      {children}
    </ShellScope>
  );
}
