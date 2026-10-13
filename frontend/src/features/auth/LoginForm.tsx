'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getSafeRedirect } from '@/lib/redirect';
import { Field, TextInput } from '@/features/ui/Field';
import { Button } from '@/features/ui/Button';
import { Skeleton } from '@/features/ui/Skeleton';
import { AuthNotice, AuthShell } from './AuthShell';
import { PasswordField } from './PasswordField';
import { AuthDivider, GoogleButton } from './GoogleButton';
import { friendlyAuthError } from './authErrors';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // OAuth callback failures land here as `?error=auth_failed`; surface the
  // failure instead of a silent login form.
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth_failed'
      ? 'Sign-in failed. Please try again.'
      : null
  );

  const supabase = createClient();
  const registerHref = `/auth/register${
    redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''
  }`;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to sign in'));
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to sign in with Google'));
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign In"
      description="Welcome back"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link href={registerHref} className="text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}

      <form onSubmit={handleLogin} className="space-y-5">
        <Field label="Email Address" name="login-email" required>
          <TextInput
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>

        <PasswordField
          label="Password"
          name="login-password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Enter your password"
          required
        />

        <div className="text-right">
          <Link
            href="/auth/forgot-password"
            className="font-body text-sm text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth isLoading={isLoading}>
          {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
        </Button>
      </form>

      <AuthDivider />

      <GoogleButton
        label="Continue with Google"
        onClick={handleGoogleLogin}
        disabled={isLoading}
      />
    </AuthShell>
  );
}

/**
 * Suspense fallback. It renders the same card frame (border + padding) as
 * `AuthShell`, so swapping it for the form does not move the page.
 */
export function LoginFallback() {
  return (
    <div className="bg-surface-card border border-border-default p-8">
      <Skeleton variant="text-block" />
    </div>
  );
}
