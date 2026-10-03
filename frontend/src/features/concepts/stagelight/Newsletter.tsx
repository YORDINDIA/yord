'use client';

import { useId, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const id = useId();

  async function handleSubmit(e: FormEvent) {
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
  }

  const note = status === 'success' ? 'You are on the list. Watch your inbox.' : status === 'error' ? errorMessage : '';

  return (
    <form className="sl-ticket" onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-title`} data-status={status}>
      <div className="sl-ticket__main">
        <h2 id={`${id}-title`} className="sl-ticket__title font-[family-name:var(--font-bevellier)]">
          Be First in Line
        </h2>
        <p className="sl-ticket__copy">
          Get exclusive early access to new drops, limited editions, and VIP-only offers. Plus, enjoy 10% off your first order.
        </p>
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          className="sl-ticket__field"
          value={email}
          disabled={status === 'loading'}
          aria-invalid={status === 'error'}
          aria-describedby={`${id}-note`}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error' || status === 'success') setStatus('idle');
          }}
        />
        <p id={`${id}-note`} role="status" className="sl-ticket__note">
          {note}
        </p>
      </div>

      <div className="sl-ticket__perf" aria-hidden="true" />

      <div className="sl-ticket__stub">
        <p className="sl-ticket__admit font-[family-name:var(--font-bevellier)]" aria-hidden="true">
          Admit <br />
          One
        </p>
        <p className="sl-ticket__club">Join the Inner Circle</p>
        <button type="submit" className="sl-ticket__btn" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending' : 'Subscribe'}
        </button>
        {status === 'success' && (
          <motion.span
            className="sl-stamp font-[family-name:var(--font-bevellier)]"
            aria-hidden="true"
            initial={{ scale: 1.6, rotate: -16 }}
            animate={{ scale: 1, rotate: -7 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          >
            Subscribed
          </motion.span>
        )}
      </div>
    </form>
  );
}
