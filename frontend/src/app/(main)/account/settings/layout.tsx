import type { Metadata } from 'next';

/**
 * `page.tsx` is a client component, so its canonical lives here. `noindex`
 * comes from `account/layout.tsx`.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/account/settings' },
};

export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
