"use client";

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="card-header">
          <div>
            <div className="brand-sub">YORD INDIA</div>
            <h1 className="card-title">Admin Access</h1>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <label className="helper">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="helper">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="badge danger">{error}</div>}
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
