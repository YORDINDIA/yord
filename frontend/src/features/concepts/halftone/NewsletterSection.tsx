'use client';

import { useState, type FormEvent } from 'react';
import { cn } from '@yord/ui';
import { RingCta } from './RingCta';
import { RevealText } from './Reveal';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;

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
    <section aria-labelledby="ht-news-title" className="ht-section ht-news">
      <div className="ht-wrap">
        <RevealText
          as="h2"
          id="ht-news-title"
          className="ht-display ht-news__title"
          segments={[{ t: 'Be First' }, { t: 'in Line', em: true }]}
        />
        <p className="ht-news__lead">
          Get exclusive early access to new drops, limited editions, and VIP-only offers. Plus, enjoy 10% off your first
          order.
        </p>

        {status !== 'success' && (
          <form className="ht-news__form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="ht-news-email" className="sr-only">
              Email address
            </label>
            <input
              id="ht-news-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Your email"
              className="ht-news__input"
              value={email}
              disabled={status === 'loading'}
              aria-invalid={status === 'error'}
              aria-describedby={status === 'error' ? 'ht-news-error' : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
            />
            <RingCta label="JOIN THE INNER CIRCLE" repeat={1} disabled={status === 'loading'} className="ht-news__ring">
              <span className="ht-display ht-news__join">{status === 'loading' ? '...' : 'Join'}</span>
            </RingCta>
          </form>
        )}

        <p role="status" className={cn('ht-news__done', status === 'success' && 'ht-news__done--ok')}>
          {status === 'loading' && 'Subscribing...'}
          {status === 'success' && 'Welcome to the inner circle! Check your inbox for your 10% discount code.'}
        </p>
        {status === 'error' && (
          <p id="ht-news-error" role="alert" className="ht-news__error">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}
