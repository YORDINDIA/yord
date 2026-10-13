'use client';

import { useState, useEffect } from 'react';
import { Mail, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/features/ui/Button';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { SECTION_PADDING } from './section';
import '@/features/ui/reveal.css';

// Static burst layout computed once at module scope (not during render);
// identical particles for every success animation, no per-render regeneration.
const SUCCESS_PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * 360;
  const distance = 80 + Math.random() * 40;
  return {
    id: i,
    angle,
    distance,
    size: 4 + Math.random() * 4,
    delay: Math.random() * 0.2,
  };
});

// Success particle burst. CSS keyframes, driven by the --particle-x/y offsets
// the component computes; the wrapper only exists while the burst runs.
function SuccessParticles({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
      {SUCCESS_PARTICLES.map((particle) => (
        <div
          key={particle.id}
          className="newsletter-particle absolute rounded-full bg-accent"
          style={{
            width: particle.size,
            height: particle.size,
            '--particle-x': `${Math.cos((particle.angle * Math.PI) / 180) * particle.distance}px`,
            '--particle-y': `${Math.sin((particle.angle * Math.PI) / 180) * particle.distance}px`,
            animationDelay: `${particle.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// Animated sparkle icon with rotation and pulse (CSS keyframes).
// `inline-flex`, not a div: this sits inside the eyebrow's `<p>`, where a
// block element is invalid HTML — and an inline one cannot be transformed.
function AnimatedSparkle({ delay = 0 }: { delay?: number }) {
  return (
    <span className="newsletter-sparkle inline-flex" style={{ animationDelay: `${delay}s` }}>
      <Sparkles size={14} className="text-accent" />
    </span>
  );
}

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  // Trigger particles on success; deferred: syncs animation flag from fetch status.
  useEffect(() => {
    if (status === 'success') {
      queueMicrotask(() => setShowParticles(true));
      const timer = setTimeout(() => setShowParticles(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to subscribe. Please try again.');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
      setErrorMessage('Failed to subscribe. Please try again.');
    }
  };

  return (
    <section className={`reveal-clip relative ${SECTION_PADDING}`}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-page via-surface-card to-surface-page" />

      {/* Decorative Elements */}
      <div className="absolute inset-0">
        {/* The wrapper owns the (composited) breathing scale/opacity; the orb
            itself is static. It used to run `animate-liquid-morph`, which
            animates `border-radius` on an 800px blurred layer — a repaint of
            the whole blur on every frame, and invisible under a 150px blur. */}
        <div className="newsletter-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]">
          <div className="w-full h-full rounded-full bg-accent-tint blur-[150px]" />
        </div>
      </div>

      {/* Content */}
      <div className="relative container-page">
        <div className="max-w-2xl mx-auto text-center">
          {/* Icon */}
          <div className="reveal-scale newsletter-icon inline-flex items-center justify-center w-16 h-16 mb-8 border border-accent/30 bg-surface-card/50">
            <div className="newsletter-icon-pulse">
              <Mail size={24} className="text-accent" />
            </div>
          </div>

          {/* Heading */}
          <SectionHeading
            className="reveal-up mb-8"
            align="center"
            eyebrow={
              <span className="inline-flex items-center gap-2">
                <AnimatedSparkle delay={0} />
                JOIN THE INNER CIRCLE
                <AnimatedSparkle delay={1.5} />
              </span>
            }
            title="Be First in Line"
            description="Get exclusive early access to new drops, limited editions, and VIP-only offers. Plus, enjoy 10% off your first order."
          />

          {/* Form */}
          <form className="reveal-up relative" onSubmit={handleSubmit}>
            {/* `--success` is the themed pair (light 4.94:1 on the page,
                dark 10.9:1). The emerald-400/-500 palette values it used
                before are bright-only: 1.7:1 on the light page. */}
            {status === 'success' ? (
              <div className="newsletter-success relative flex items-center justify-center gap-3 py-4 px-6 bg-success/10 border border-success/30 overflow-visible">
                <SuccessParticles show={showParticles} />
                <div className="newsletter-success-icon">
                  <CheckCircle size={20} className="text-success" />
                </div>
                <span className="font-body text-success">
                  Welcome to the inner circle! Check your inbox for your 10% discount code.
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    {/* Input glow layers */}
                    <div
                      className={`absolute -inset-[2px] bg-gradient-to-r from-accent/50 via-accent-hover/50 to-accent/50 blur-sm pointer-events-none transition-opacity duration-300 ${
                        isFocused ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <div
                      className={`absolute -inset-[1px] bg-gradient-to-r from-accent via-accent-hover to-accent pointer-events-none transition-opacity duration-300 ${
                        isFocused ? 'opacity-60' : 'opacity-0'
                      }`}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (status === 'error') setStatus('idle');
                      }}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="Enter your email address"
                      aria-label="Email address"
                      aria-invalid={status === 'error'}
                      aria-describedby={status === 'error' ? 'newsletter-error' : undefined}
                      className="relative w-full bg-surface-card border border-border-default text-text-primary px-6 py-4 text-base placeholder:text-text-muted focus:border-accent transition-all duration-300"
                      style={{
                        boxShadow: isFocused
                          ? `0 0 20px color-mix(in srgb, var(--accent) 20%, transparent), 0 0 40px color-mix(in srgb, var(--accent) 10%, transparent)`
                          : 'none',
                      }}
                      disabled={status === 'loading'}
                    />
                    {/* `--danger` is the themed pair; the red-700/dark:red-400
                        palette values it used before were the only raw palette
                        classes left in this file. */}
                    {status === 'error' && (
                      <p
                        id="newsletter-error"
                        role="alert"
                        className="newsletter-error absolute left-0 -bottom-6 text-sm text-danger"
                      >
                        {errorMessage}
                      </p>
                    )}
                  </div>
                  <Button type="submit" size="lg" isLoading={status === 'loading'} className="shrink-0">
                    SUBSCRIBE
                  </Button>
                </div>
              </>
            )}
          </form>

          {/* Privacy Note */}
          <p className="reveal-fade mt-6 font-body text-xs text-text-muted">
            By subscribing, you agree to our Privacy Policy. No spam, ever. Unsubscribe anytime.
          </p>

          {/* Benefits */}
          <div className="reveal-up mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-text-muted">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent" />
              <span>Early Access</span>
            </div>
            <div className="w-px h-4 bg-surface-inset hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent" />
              <span>Exclusive Offers</span>
            </div>
            <div className="w-px h-4 bg-surface-inset hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent" />
              <span>10% Off First Order</span>
            </div>
            <div className="w-px h-4 bg-surface-inset hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-accent" />
              <span>No Spam</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
