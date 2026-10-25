'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { CtaLink } from '@/features/ui/CtaLink';
import { CAMPAIGN, campaignEndsLabel, tierForScore } from './config';
import { QUIZ_QUESTION_COUNT } from './questions';
import type { QuizResult } from './quizStore';

/**
 * The reveal: the score, the tier, and the code.
 *
 * The code is shown as text, not as an image or a hidden field, because a
 * shopper's first instinct is to screenshot it and their second is to send it to
 * whoever they are going to the show with. Copy is a convenience on top of that,
 * never the only way to get it — clipboard access is refused often enough in
 * in-app browsers that a copy-only reveal would strand people.
 *
 * The CTA goes to the artist collection rather than straight to the cart: the
 * cart is empty at this point, and the discount is worth nothing until something
 * is in it.
 */
export function QuizResultView({ result }: { result: QuizResult }) {
  const [copied, setCopied] = useState(false);
  const tier = tierForScore(result.correct);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Refused or unavailable: the code is on screen and selectable, so there
      // is nothing to recover from. Leaving the button state alone is honest.
    }
  };

  return (
    <div className="px-6 pb-8 pt-8 sm:px-10">
      <p className="font-accent text-sm tracking-[0.2em] text-text-muted">
        {result.correct} / {QUIZ_QUESTION_COUNT} CORRECT · {tier.label.toUpperCase()} TIER
      </p>

      <h2 className="mt-3 font-display text-3xl leading-tight text-text-primary sm:text-4xl">
        {tier.headline}
      </h2>
      <p className="mt-2 text-text-muted">{tier.blurb}</p>

      {/* The reward, as the loudest thing on the screen — a ticket stub: dashed
          edge, the site's gold glow, the code selectable inside it. */}
      <div className="mt-8 rounded-[2px] border border-accent bg-accent-tint px-5 py-6 text-center shadow-[var(--shadow-gold)]">
        <p className="font-display-alt text-6xl leading-none text-accent">{result.percent}%</p>
        <p className="mt-1.5 font-accent text-sm tracking-[0.25em] text-text-secondary">
          OFF YOUR ORDER
        </p>

        <p className="mt-6 font-accent text-[10px] tracking-[0.3em] text-text-muted">YOUR CODE</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          {/* Selectable text, not a disabled input: this is the code. */}
          <code className="select-all rounded-[2px] border border-dashed border-accent/60 bg-surface-input px-4 py-2.5 font-mono text-lg tracking-[0.15em] text-text-primary">
            {result.code}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied ? 'Code copied' : `Copy code ${result.code}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border border-border-default text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {copied ? (
              <Check className="h-4 w-4 text-accent" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <p aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-text-muted">
          {copied ? 'Copied.' : ''}
        </p>

        <p className="mt-1 text-xs text-text-muted">Use it by {campaignEndsLabel()}.</p>
      </div>

      <p className="mt-5 text-sm text-text-muted">
        Enter the code in the cart or at checkout. It works once, on one order.
      </p>

      <div className="mt-6">
        <CtaLink href={CAMPAIGN.merchUrl} variant="gold" size="lg" fullWidth>
          Shop {CAMPAIGN.artistName}
        </CtaLink>
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        <Link
          href={CAMPAIGN.concertUrl}
          className="underline decoration-border-strong underline-offset-2 hover:text-text-secondary"
        >
          {CAMPAIGN.artistName} at {CAMPAIGN.venue}, {CAMPAIGN.city}
        </Link>
      </p>

      {/* Says the quiet part out loud: a second play cannot improve the reward,
          so nobody wastes a minute finding that out. */}
      <p className="mt-3 text-center text-xs text-text-subtle">
        One code per visitor, so replaying will not change it.
      </p>
    </div>
  );
}
