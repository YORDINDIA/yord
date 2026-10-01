'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Mail, Lock, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSafeRedirect } from '@/lib/redirect';

export function RegisterForm() {
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pass)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pass)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pass)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

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
      setError(err instanceof Error ? err.message : 'Failed to create account');
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
      setError(err instanceof Error ? err.message : 'Failed to sign up with Google');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-surface-page pt-24 pb-16 flex items-center justify-center">
        <div className="w-full max-w-[440px] mx-auto px-6">
          <div className="bg-surface-card border border-border-default p-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-4">
              Check Your Email
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted mb-6">
              We&apos;ve sent a confirmation link to <span className="text-text-secondary">{email}</span>.
              Click the link in your email to verify your account.
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-8 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors"
            >
              BACK TO LOGIN
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-page pt-24 pb-16 flex items-center justify-center">
      <div className="w-full max-w-[440px] mx-auto px-6">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.2em] text-text-primary">
              YORD
            </h1>
          </Link>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted mt-2">
            Join the community
          </p>
        </div>

        {/* Register Form */}
        <div className="bg-surface-card border border-border-default p-8">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-6 text-center">
            Create Account
          </h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-[family-name:var(--font-jakarta)]">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="register-first-name" className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                  First Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    id="register-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="register-last-name" className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                  Last Name
                </label>
                <input
                  id="register-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  className="w-full px-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="register-email" className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="register-password" className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  className="w-full pl-11 pr-12 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-muted"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="mt-1 font-[family-name:var(--font-jakarta)] text-xs text-text-muted">
                Min 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="register-confirm-password" className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-text-muted mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  id="register-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-surface-raised border border-border-default text-text-secondary font-[family-name:var(--font-jakarta)] text-sm placeholder:text-text-muted focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  CREATING ACCOUNT...
                </>
              ) : (
                'CREATE ACCOUNT'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-surface-inset" />
            <span className="font-[family-name:var(--font-jakarta)] text-xs text-text-muted uppercase">
              or
            </span>
            <div className="flex-1 h-px bg-surface-inset" />
          </div>

          {/* Social Signup */}
          <button
            onClick={handleGoogleSignUp}
            disabled={isLoading}
            className="w-full py-3 border border-border-strong text-text-secondary font-[family-name:var(--font-jakarta)] text-sm hover:border-text-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Login Link */}
          <p className="mt-6 text-center font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
            Already have an account?{' '}
            <Link
              href={`/auth/login${redirectTo !== '/account' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
              className="text-accent hover:underline"
            >
              Sign in
            </Link>
          </p>

          {/* Terms */}
          <p className="mt-4 text-center font-[family-name:var(--font-jakarta)] text-xs text-text-muted">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-accent hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export function RegisterFallback() {
  return (
    <main className="min-h-screen bg-surface-page pt-24 pb-16 flex items-center justify-center">
      <div className="w-full max-w-[440px] mx-auto px-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
        </div>
      </div>
    </main>
  );
}


