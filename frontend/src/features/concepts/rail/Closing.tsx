'use client';

import { useId, useState, type FormEvent } from 'react';
import { ArrowOut } from './Glyphs';

type Status = 'idle' | 'loading' | 'success' | 'error';

/** The last line of the rail, and the list for the next one. */
export function Closing() {
  const id = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setStatus('error');
      setMessage('Enter a valid email address.');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'That did not go through. Try again.');
        return;
      }
      setStatus('success');
      setMessage('You are on the list for the next rail.');
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('That did not go through. Try again.');
    }
  }

  return (
    <section className="rl-closing" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="rl-closing__line">
        Made to be worn.
        <span>Not scrolled past.</span>
      </h2>
      <form className="rl-signup" onSubmit={submit} noValidate>
        <label htmlFor={`${id}-email`} className="rl-signup__label">
          Hear when the next rail is hung.
        </label>
        <div className="rl-signup__field">
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            aria-invalid={status === 'error' || undefined}
            aria-describedby={`${id}-note`}
          />
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending' : 'Notify me'}
            <ArrowOut />
          </button>
        </div>
        <p id={`${id}-note`} className="rl-signup__note" data-status={status} aria-live="polite">
          {message}
        </p>
      </form>
    </section>
  );
}
