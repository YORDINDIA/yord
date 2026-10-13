'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Field, TextInput } from '@/features/ui/Field';
import { Button } from '@/features/ui/Button';
import { CtaLink } from '@/features/ui/CtaLink';
import { AuthNotice, AuthShell, AuthStateIcon } from '@/features/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
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
        <p className="font-body text-sm text-text-muted text-center mb-6">
          If an account exists for <span className="text-text-secondary">{email}</span>, you&apos;ll
          receive a password reset link.
        </p>
        <CtaLink href="/auth/login" fullWidth>
          Back to login
        </CtaLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset Password"
      description="Enter your email address and we'll send you a link to reset your password."
      footer={
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to login
        </Link>
      }
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email Address" name="forgot-email" required>
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

        <Button type="submit" fullWidth isLoading={isLoading}>
          {isLoading ? 'SENDING...' : 'SEND RESET LINK'}
        </Button>
      </form>
    </AuthShell>
  );
}
