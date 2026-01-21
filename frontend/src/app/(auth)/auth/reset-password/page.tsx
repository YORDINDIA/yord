'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Loader2, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

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
      setTimeout(() => {
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
      <main className="min-h-screen bg-noir-950 pt-24 pb-16 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-green-500/10 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-ivory-50 mb-4">
              Password Updated
            </h1>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 mb-6">
              Your password has been successfully reset. Redirecting to login...
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
            >
              GO TO LOGIN
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-ivory-50 mb-2">
            Reset Password
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-red-300">
                {error}
              </p>
            </div>
          )}

          <div>
            <label className="block font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 mb-2">
              NEW PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full h-12 px-4 bg-noir-900 border border-noir-700 text-ivory-50 font-[family-name:var(--font-jakarta)] placeholder:text-ivory-500 focus:outline-none focus:border-gold-200"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="block font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 mb-2">
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full h-12 px-4 bg-noir-900 border border-noir-700 text-ivory-50 font-[family-name:var(--font-jakarta)] placeholder:text-ivory-500 focus:outline-none focus:border-gold-200"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 flex items-center justify-center gap-2 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                RESETTING...
              </>
            ) : (
              'RESET PASSWORD'
            )}
          </button>
        </form>

        <p className="mt-8 text-center font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-gold-200 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-noir-950 pt-24 pb-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-200 animate-spin" />
      </main>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
