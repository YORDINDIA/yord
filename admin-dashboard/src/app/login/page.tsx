import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Package, Receipt, Sparkles } from 'lucide-react';
import AmbientAurora from '@/components/reactbits/AmbientAurora';
import AnimatedTitle from '@/components/reactbits/AnimatedTitle';
import BrandShimmer from '@/components/reactbits/BrandShimmer';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LoginCard from './login-card';
import LoginForm from './login-form';
import styles from './login.module.css';

/**
 * Sign in.
 *
 * A server component so it can carry its own `metadata` and render the
 * brand panel as static markup; only the form and the ambient pieces
 * are client components, and the form sits under the `<Suspense>`
 * boundary `useSearchParams` requires.
 *
 * Two panels at ≥900px (brand left, form right), form only below that
 * with a compact brand header on top. The fixed aurora behind the
 * form column is the same whisper the dashboard carries, so signing
 * in reads as the front door of the same building.
 */
export const metadata: Metadata = {
  title: 'Sign in · YORD Admin',
  description: 'Sign in to the YORD India admin console.',
};

/** What the console covers — three short claims, not a feature list. */
const CAPABILITIES = [
  { icon: Package, label: 'Catalogue, inventory, and media' },
  { icon: Receipt, label: 'Orders, fulfilment, and refunds' },
  { icon: Sparkles, label: 'AI drafting for blogs and listings' },
] as const;

/**
 * Host shown in the footer, from the configured storefront address.
 *
 * Read at request time and never trusted as a link: a malformed value drops the
 * line instead of rendering half a URL.
 */
function appHost(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    return new URL(configured).host;
  } catch {
    return null;
  }
}

/**
 * Shape of the form while the client component hydrates. Mirrors the real
 * field heights (30px input, 32px button) so nothing jumps when it swaps in.
 */
function FormFallback() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the sign-in form…</span>
      <div className="stack-sm" aria-hidden="true">
        <span className="skeleton" style={{ width: 44, height: 9 }} />
        <span className="skeleton" style={{ width: '100%', height: 30, borderRadius: 8 }} />
        <span className="skeleton" style={{ width: 62, height: 9, marginTop: 4 }} />
        <span className="skeleton" style={{ width: '100%', height: 30, borderRadius: 8 }} />
        <span className="skeleton" style={{ width: '100%', height: 32, borderRadius: 8, marginTop: 8 }} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const host = appHost();

  return (
    <div className={styles.page}>
      <AmbientAurora className="aurora-layer" amplitude={0.5} blend={0.8} />

      <aside className={styles.brand}>
        <div className={styles.brandInner}>
          <div className={styles.identity}>
            <span className={styles.mark} aria-hidden="true">
              Y
            </span>
            <span className={styles.wordmark}>
              <BrandShimmer text="YORD" speed={3.2} spread={120} />
              <span className={styles.wordmarkTail}>India</span>
            </span>
          </div>

          <p className={styles.statement}>The control room for the YORD India storefront.</p>

          <ul className={styles.capabilities}>
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <li key={label} className={styles.capability}>
                <span className={styles.capabilityIcon} aria-hidden="true">
                  <Icon size={14} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className={styles.formPanel}>
        <div className={styles.formInner}>
          <LoginCard>
            <header className={styles.formHead}>
              <AnimatedTitle tag="h1" text="Admin sign in" className={styles.formTitle} />
              <p className="helper">Use your YORD admin account. Access is limited to active admins.</p>
            </header>

            <Suspense fallback={<FormFallback />}>
              <LoginForm />
            </Suspense>
          </LoginCard>

          <div className={styles.meta}>
            <span>YORD Admin</span>
            {host && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`mono truncate ${styles.metaHost}`} title="NEXT_PUBLIC_APP_URL">
                  {host}
                </span>
              </>
            )}
            <span className="spacer" />
            <ThemeToggle />
          </div>
        </div>
      </main>
    </div>
  );
}
