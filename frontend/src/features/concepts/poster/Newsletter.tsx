'use client';

import { useState } from 'react';
import { Arrow } from './Arrow';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

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

  const message =
    status === 'success'
      ? 'Welcome to the inner circle! Check your inbox for your 10% discount code.'
      : status === 'error'
        ? errorMessage
        : status === 'loading'
          ? 'Subscribing...'
          : '';

  return (
    <section aria-labelledby="poster-news" className="poster-news">
      <div className="poster-news-fit">
        <h2 id="poster-news" className="poster-display poster-news-title">
          Be First in Line
        </h2>
      </div>

      <div className="poster-pad poster-news-body">
        <p className="poster-news-lead">
          Early access to new drops, limited editions and VIP offers. Plus 10% off your first order.
        </p>

        <form onSubmit={handleSubmit} noValidate className="poster-news-form" hidden={status === 'success'}>
          <label htmlFor="poster-email" className="sr-only">
            Email address
          </label>
          <input
            id="poster-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Your email address"
            value={email}
            readOnly={status === 'loading'}
            aria-invalid={status === 'error'}
            aria-describedby="poster-news-status"
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
          />
          <button type="submit" disabled={status === 'loading'} data-cursor="pointer">
            Join the inner circle
            <Arrow className="poster-textlink-arrow" />
          </button>
        </form>

        <p id="poster-news-status" role="status" aria-live="polite" className="poster-news-status" data-state={status}>
          {message}
        </p>
        <p className="poster-news-fine">No spam, ever. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
