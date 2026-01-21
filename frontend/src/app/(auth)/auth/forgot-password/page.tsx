'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
      <main className="min-h-screen bg-noir-950 pt-24 pb-16 flex items-center justify-center">
        <div className="w-full max-w-[440px] mx-auto px-6">
          <div className="bg-noir-900 border border-noir-800 p-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-4">
              Check Your Email
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mb-6">
              If an account exists for <span className="text-ivory-100">{email}</span>,
              you&apos;ll receive a password reset link.
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
            >
              BACK TO LOGIN
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16 flex items-center justify-center">
      <div className="w-full max-w-[440px] mx-auto px-6">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.2em] text-ivory-50">
              YORD
            </h1>
          </Link>
        </div>

        {/* Forgot Password Form */}
        <div className="bg-noir-900 border border-noir-800 p-8">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-ivory-400 hover:text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>

          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-2">
            Reset Password
          </h2>
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mb-6">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-[family-name:var(--font-jakarta)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-ivory-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ivory-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-noir-800 border border-noir-700 text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm placeholder:text-ivory-500 focus:outline-none focus:border-gold-200 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  SENDING...
                </>
              ) : (
                'SEND RESET LINK'
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
