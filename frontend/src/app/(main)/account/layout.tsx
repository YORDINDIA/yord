import type { Metadata } from 'next';
import { AccountShell } from './_components/AccountShell';

/**
 * Private subtree. `noindex` is declared once, here, so a page added under
 * `/account` inherits it — and it has to be a layout, because every page in
 * this subtree is a client component, which cannot export metadata.
 *
 * The canonical is the subtree default (this segment's own URL); each child
 * overrides it with its own — `orders/`, `settings/` and `wishlist/` through a
 * leaf layout, `orders/[id]` by resolving the order URL. A future page that
 * declares none would inherit `/account`: wrong, but harmless, since nothing
 * in this subtree is indexable.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: '/account' },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
