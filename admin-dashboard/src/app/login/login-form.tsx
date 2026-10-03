'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import SparkButton from '@/components/reactbits/SparkButton';
import { getSupabaseClient } from '@/lib/supabase/client';
import styles from './login.module.css';

/**
 * Sign-in form.
 *
 * Client-only because it reads `?redirect=` and drives the Supabase browser
 * client. It is rendered under a `<Suspense>` boundary in `page.tsx` (the
 * server page), which is what lets `useSearchParams` SSR without opting the
 * whole route out of prerendering.
 *
 * Every field is labelled and named so a password manager can fill it, and the
 * failure message is a `role="alert"` region wired to both inputs through
 * `aria-describedby` rather than a badge that only sighted users can find.
 */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auth only, via the shared memoized browser client. Every data read in the
  // admin app goes through `lib/data` and every write through a server action.
  const supabase = getSupabaseClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(redirect);
  }

  const errorId = 'login-error';

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="field">
        <label className="label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="input"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          autoCapitalize="none"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="login-password">
          Password
        </label>
        <div className={styles.passwordField}>
          <input
            id="login-password"
            className="input"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            aria-controls="login-password"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          </button>
        </div>
        {/* Supabase persists the session in its own cookie storage and refreshes
            it automatically, so there is no "remember me" toggle to offer —
            only the behaviour as it is. */}
        <p className="helper">This device stays signed in until you sign out.</p>
      </div>

      {error && (
        <div id={errorId} className="form-alert form-alert-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* The press is answered by a short spark burst in the accent
          hue (gone under reduced motion) — the same feedback the
          dashboard's tiles give. */}
      <SparkButton
        className="large block"
        type="submit"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <Loader2 size={14} className={styles.spin} aria-hidden="true" />
        ) : (
          <LogIn size={14} aria-hidden="true" />
        )}
        {loading ? 'Signing in…' : 'Sign in'}
      </SparkButton>
    </form>
  );
}

/**
 * Same-origin redirect guard.
 *
 * `/\evil.com` passes a naive `startsWith('/') && !startsWith('//')` check,
 * but the browser normalizes the backslash to a slash and navigates to
 * `https://evil.com/` after login. Reject backslashes outright and verify the
 * resolved URL stays on this origin.
 */
function safeRedirect(value: string | null): string {
  const fallback = '/dashboard';
  if (!value || !value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const resolved = new URL(value, window.location.origin);
    if (resolved.origin !== window.location.origin) return fallback;
  } catch {
    return fallback;
  }
  return value;
}
