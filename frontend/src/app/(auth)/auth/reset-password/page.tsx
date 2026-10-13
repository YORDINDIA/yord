'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Check, KeyRound, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/features/ui/Button';
import { CtaLink } from '@/features/ui/CtaLink';
import { AuthNotice, AuthShell, AuthStateIcon } from '@/features/auth/AuthShell';
import { PasswordField } from '@/features/auth/PasswordField';

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // null = checking, true = valid recovery session, false = expired/invalid link
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => () => {
    if (redirectTimer.current !== null) clearTimeout(redirectTimer.current);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const lengthError =
      password.length < 8 ? 'Password must be at least 8 characters long' : null;
    const matchError = password !== confirmPassword ? 'Passwords do not match' : null;
    setPasswordError(lengthError);
    setConfirmError(matchError);
    if (lengthError || matchError) return;

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      redirectTimer.current = setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell
        title="Password updated"
        icon={
          <AuthStateIcon>
            <Check className="w-8 h-8" />
          </AuthStateIcon>
        }
      >
        <p className="font-body text-sm text-text-muted text-center mb-6" role="status">
          Your password has been successfully reset. Redirecting to login...
        </p>
        <CtaLink href="/auth/login" fullWidth>
          Go to login
        </CtaLink>
      </AuthShell>
    );
  }

  if (hasSession === null) {
    return (
      <div className="bg-surface-card border border-border-default p-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
        <span className="sr-only">Checking your reset link</span>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <AuthShell
        title="Link expired"
        icon={
          <AuthStateIcon tone="danger">
            <AlertCircle className="w-8 h-8" />
          </AuthStateIcon>
        }
      >
        <p className="font-body text-sm text-text-muted text-center mb-6">
          This password reset link is invalid or has expired. Request a new one to continue.
        </p>
        <CtaLink href="/auth/forgot-password" fullWidth>
          Request new link
        </CtaLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset Password"
      description="Enter your new password below."
      icon={
        <AuthStateIcon tone="accent">
          <KeyRound className="w-8 h-8" />
        </AuthStateIcon>
      }
      footer={
        <>
          Remember your password?{' '}
          <Link href="/auth/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <PasswordField
          label="New Password"
          name="reset-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (passwordError) setPasswordError(null);
          }}
          autoComplete="new-password"
          placeholder="Enter new password"
          error={passwordError ?? undefined}
          required
        />

        <PasswordField
          label="Confirm Password"
          name="reset-confirm-password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            if (confirmError) setConfirmError(null);
          }}
          autoComplete="new-password"
          placeholder="Confirm new password"
          error={confirmError ?? undefined}
          required
        />

        <Button type="submit" fullWidth isLoading={isLoading}>
          {isLoading ? 'RESETTING...' : 'RESET PASSWORD'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-surface-card border border-border-default p-8 flex justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading reset form</span>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
