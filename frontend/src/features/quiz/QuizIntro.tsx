'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@yord/ui';
import { Button } from '@/features/ui/Button';
import { CAMPAIGN, QUIZ_TIERS } from './config';
import { QUIZ_QUESTION_COUNT } from './questions';

/**
 * The first screen: what this is, what is at stake, and a way out.
 *
 * The reward is stated as a range up front rather than hidden until the result.
 * A pop-up that will not say what it is for reads as a mailing-list trap, and
 * the whole point of a quiz gate is that a shopper chooses to play.
 *
 * The show's facts (artist, city, date, countdown) are the masthead's job and
 * are not repeated here.
 */
export function QuizIntro({ onStart }: { onStart: () => void }) {
  return (
    <div className="px-6 pb-8 pt-8 sm:px-10">
      <h2 className="font-display text-3xl leading-tight text-text-primary sm:text-4xl">
        How big a <em className="italic text-accent">Diljit</em> fan are you?
      </h2>

      {/* Deliberately not the offer sentence: the page's pitch above the card
          already states it, and the ladder below shows the percentages — so
          this line carries the mechanic and the guarantee instead. */}
      <p className="mt-3 text-text-muted">
        {QUIZ_QUESTION_COUNT} questions, easy to hard. Everyone who finishes earns a code — the
        ladder below is what you are playing for.
      </p>

      {/* The ladder, so nobody has to guess what a bad round costs them. Easiest
          rung first so it reads as climbing, ending on the crowned gold row. */}
      <ul className="mt-6 space-y-2">
        {[...QUIZ_TIERS].reverse().map((tier) => (
          <li
            key={tier.id}
            className={cn(
              'flex items-center justify-between gap-4 rounded-[2px] border px-4 py-3',
              tier.id === 'gold' ? 'border-accent bg-accent-tint' : 'border-border-default'
            )}
          >
            <span className="flex min-w-0 items-baseline gap-3">
              <span
                className={cn(
                  'shrink-0 font-accent text-sm tracking-[0.2em]',
                  tier.id === 'gold' ? 'text-accent' : 'text-text-secondary'
                )}
              >
                {tier.label}
              </span>
              <span className="truncate text-xs text-text-muted">
                {tier.minCorrect === 0 ? 'anyone who plays' : `${tier.minCorrect}+ correct`}
              </span>
            </span>
            <span className="shrink-0 font-display-alt text-lg text-accent">{tier.percent}% off</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <Button onClick={onStart} variant="gold" size="lg" fullWidth>
          Start the quiz
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        One code per visitor. Yours to use until the campaign closes.{' '}
        <Link
          href={CAMPAIGN.concertUrl}
          className="underline decoration-border-strong underline-offset-2 hover:text-text-secondary"
        >
          More about the show
          <ArrowRight className="ml-1 inline h-3 w-3" aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}
