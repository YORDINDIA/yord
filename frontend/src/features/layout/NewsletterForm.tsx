'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/features/ui/Button';
import { Field, TextInput } from '@/features/ui/Field';

const LABEL = 'JOIN THE INNER CIRCLE';
const HINT = 'Early access to drops. Exclusive offers. No spam.';

/**
 * The footer's newsletter sign-up — the only interactive part of the footer,
 * and the reason the whole footer used to be a client component (shipping 30+
 * links, five columns and the social row in every route's client bundle).
 *
 * Two failures it used to have: an email with no `@` returned silently, and a
 * rejected subscribe rendered nothing at all, so a failed signup was
 * indistinguishable from an ignored click. Both now surface through the
 * `Field`'s error channel.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();

    if (!value || !value.includes('@')) {
      setError('Enter an email address so we can add you to the list.');
      return;
    }

    setError(undefined);
    setStatus('loading');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });

      if (response.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
        setError('We could not sign you up just now. Please try again in a moment.');
      }
    } catch {
      setStatus('error');
      setError('We could not reach the server. Check your connection and try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="space-y-4">
        {/* Not a <label> here: the control it labelled is gone. */}
        <p className="font-accent text-xs tracking-[0.2em] text-text-muted">{LABEL}</p>
        <div className="flex items-center gap-2 py-3 text-success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          <span className="font-body text-sm">Thanks for subscribing!</span>
        </div>
        <p className="text-xs text-text-muted">{HINT}</p>
      </div>
    );
  }

  return (
    <Field
      // The visible eyebrow IS the label — it used to be an unassociated <p>
      // next to an input that had only a placeholder.
      label={<span className="font-accent tracking-[0.2em]">{LABEL}</span>}
      name="newsletter"
      error={error}
    >
      <form onSubmit={handleSubmit} className="flex gap-2">
        <TextInput
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          disabled={status === 'loading'}
          className="flex-1"
        />
        <Button type="submit" isLoading={status === 'loading'} className="shrink-0">
          Subscribe
        </Button>
      </form>
      <p className="text-xs text-text-muted">{HINT}</p>
    </Field>
  );
}
