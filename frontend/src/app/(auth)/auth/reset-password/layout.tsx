import type { Metadata } from 'next';

/**
 * The page is a client component, so its canonical lives here. `robots` is not
 * repeated: `(auth)/layout.tsx` already keeps all four auth screens out of the
 * index, and a leaf must not re-open a subtree that a parent closed.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/auth/reset-password' },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
