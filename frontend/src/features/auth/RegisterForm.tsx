'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSafeRedirect } from '@/lib/redirect';
import { Field, TextInput } from '@/features/ui/Field';
import { Button } from '@/features/ui/Button';
import { CtaLink } from '@/features/ui/CtaLink';
import { Skeleton } from '@/features/ui/Skeleton';
import { AuthNotice, AuthShell, AuthStateIcon } from './AuthShell';
import { PasswordField } from './PasswordField';
import { AuthDivider, GoogleButton } from './GoogleButton';
import { friendlyAuthError } from './authErrors';

const PASSWORD_HINT = 'Min 8 characters with uppercase, lowercase, and number';

/** The one password rule set, shared by the field check and the inline error. */
function validatePassword(pass: string): string | null {
  if (pass.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pass)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pass)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pass)) return 'Password must contain at least one number';
  return null;
}

export function RegisterForm() {
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Rules the browser cannot check for us (strength, match). Per-field rather
  // than one banner, so the message sits on the input that has to change.
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const supabase = createClient();
  const loginHref = `/auth/login${
    redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''
  }`;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const strengthError = validatePassword(password);
    const matchError = password !== confirmPassword ? 'Passwords do not match' : null;
    setPasswordError(strengthError);
    setConfirmError(matchError);
    if (strengthError || matchError) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (err) {
      setError(friendlyAuthError(err, 'Failed to create account'));
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
      setError(friendlyAuthError(err, 'Failed to sign up with Google'));
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell
        title="Check your email"
        icon={
          <AuthStateIcon>
            <Mail className="w-8 h-8" />
          </AuthStateIcon>
        }
      >
        <p className="font-body text-sm text-text-muted text-center mb-4">
          If <span className="text-text-secondary">{email}</span> is new to YORD, we&apos;ve sent
          it a confirmation link. Click the link to verify your account.
        </p>
        {/* Supabase sends nothing for an email that already has an account, and
            says so to nobody (anti-enumeration). Imported Shopify customers have
            an account with no password, so point every reader at both ways in. */}
        <p className="font-body text-sm text-text-muted text-center mb-6">
          No email after a few minutes? This address may already have an account.{' '}
          <Link href={loginHref} className="text-accent hover:underline">
            Sign in
          </Link>
          , or{' '}
          <Link href="/auth/forgot-password" className="text-accent hover:underline">
            reset your password
          </Link>{' '}
          if you have forgotten it or never set one.
        </p>
        <CtaLink href="/auth/login" fullWidth>
          Back to login
        </CtaLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create Account"
      description="Join the community"
      footer={
        <>
          Already have an account?{' '}
          <Link href={loginHref} className="text-accent hover:underline">
            Sign in
          </Link>
          <p className="mt-4 text-xs">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-accent hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>
          </p>
        </>
      }
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}

      <form onSubmit={handleRegister} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name" name="register-first-name" required>
            <TextInput
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              required
            />
          </Field>
          <Field label="Last Name" name="register-last-name" required>
            <TextInput
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              required
            />
          </Field>
        </div>

        <Field label="Email Address" name="register-email" required>
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
          name="register-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (passwordError) setPasswordError(null);
          }}
          autoComplete="new-password"
          placeholder="Create a strong password"
          hint={PASSWORD_HINT}
          error={passwordError ?? undefined}
          required
        />

        <PasswordField
          label="Confirm Password"
          name="register-confirm-password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            if (confirmError) setConfirmError(null);
          }}
          autoComplete="new-password"
          placeholder="Confirm your password"
          error={confirmError ?? undefined}
          required
        />

        <Button type="submit" fullWidth isLoading={isLoading}>
          {isLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
        </Button>
      </form>

      <AuthDivider />

      <GoogleButton
        label="Continue with Google"
        onClick={handleGoogleSignUp}
        disabled={isLoading}
      />
    </AuthShell>
  );
}

/** Same card frame as `AuthShell`, so the Suspense swap does not move the page. */
export function RegisterFallback() {
  return (
    <div className="bg-surface-card border border-border-default p-8">
      <Skeleton variant="text-block" />
    </div>
  );
}
