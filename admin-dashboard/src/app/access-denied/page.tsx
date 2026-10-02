'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldAlert, Store } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { getSupabaseClient } from '@/lib/supabase/client';
import styles from './access-denied.module.css';

/** A snapshot-based read of a build-time constant never has anything to subscribe to. */
const NO_SUBSCRIBE = () => () => {};

/** Server snapshot: the storefront link simply is not there until hydration. */
const NO_STOREFRONT = () => null;

/**
 * Storefront origin, or null when there is nothing worth linking to.
 *
 * Browser-only by nature (the same-origin comparison needs `location`), so it is
 * read through `useSyncExternalStore` rather than an effect: the server snapshot
 * is null, the client snapshot resolves after hydration, and neither can cause a
 * hydration mismatch or a setState inside an effect body.
 *
 * A same-origin value is dropped: in dev both apps serve :3000, and a
 * "storefront" link that reloads the admin would be a lie.
 */
function storefrontSnapshot(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured || typeof window === 'undefined') return null;
  try {
    const url = new URL(configured);
    return url.origin === window.location.origin ? null : url.origin;
  } catch {
    return null;
  }
}

/**
 * Redirect target for a signed-in account that is not an active admin.
 *
 * `middleware.ts` sends authenticated non-admins here, and the `(admin)` layout
 * redirects here too (defence in depth), so this page is deliberately outside
 * the shell: it must render for someone who cannot load any admin data.
 *
 * The only auth work here is the sign-out the page exists to offer — the same
 * `getSupabaseClient().auth.signOut()` the topbar calls. The email is read for
 * display only, from the persisted session, so no server round trip is spent on
 * a label. An active admin never sees this page: middleware bounces them to the
 * dashboard first.
 */
export default function AccessDeniedPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const storefront = useSyncExternalStore(NO_SUBSCRIBE, storefrontSnapshot, NO_STOREFRONT);

  useEffect(() => {
    let active = true;
    void getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setEmail(data.session?.user.email ?? null);
        setChecked(true);
      })
      // An unreadable session is not a reason to blank the page: it still
      // renders the message and the "Go to sign in" action below.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await getSupabaseClient().auth.signOut();
    router.replace('/login');
  }

  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.head}>
          <span className="tone-tile lg tone-amber" aria-hidden="true">
            <ShieldAlert size={18} />
          </span>
          <div>
            <h1 className={styles.title}>Admin access required</h1>
            <p className="helper">Signed in, but not as an active admin.</p>
          </div>
        </div>

        <p className={styles.copy}>
          The YORD admin console is limited to accounts marked as active admins. This account is
          signed in but has no active admin access, so nothing here is readable — the storefront is
          unaffected.
        </p>

        <p className={styles.copy}>
          If you should have access, ask an existing admin to activate your account, then sign in
          again.
        </p>

        <div className={styles.identity}>
          {email ? (
            <>
              <span className="helper">Signed in as</span>
              <span className="chip mono">{email}</span>
            </>
          ) : (
            checked && <span className="helper">No account is signed in on this browser.</span>
          )}
        </div>

        <div className={styles.actions}>
          {email ? (
            <button
              type="button"
              className="button primary"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-busy={signingOut}
            >
              <LogOut size={13} aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          ) : (
            <Link className="button primary" href="/login">
              Go to sign in
            </Link>
          )}

          {storefront && (
            <a className="button" href={storefront} target="_blank" rel="noreferrer">
              <Store size={13} aria-hidden="true" />
              Back to storefront
            </a>
          )}

          <span className="spacer" />
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}
