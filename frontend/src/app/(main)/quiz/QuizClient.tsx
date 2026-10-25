'use client';

import dynamic from 'next/dynamic';
import { CAMPAIGN, QUIZ_TIERS, campaignEndsLabel } from '@/features/quiz/config';
import { QuizMasthead } from '@/features/quiz/QuizMasthead';
import { QUIZ_QUESTION_COUNT } from '@/features/quiz/questions';
import { useCampaignOpenOnServerClock } from '@/features/quiz/useCountdown';

/**
 * The `/quiz` page's client half.
 *
 * `QuizRunner` is loaded with `next/dynamic` and `ssr: false` for the same
 * reason the pop-up is: the runner's first act is to read localStorage and the
 * clock, so a server render of it would either be wrong or be thrown away. What
 * is server-rendered is everything a search engine and a link preview need —
 * the masthead's `h1` and the pitch line, which live here above the dynamic
 * import boundary.
 */
const QuizRunner = dynamic(
  () => import('@/features/quiz/QuizRunner').then((mod) => mod.QuizRunner),
  {
    ssr: false,
    loading: () => (
      <div className="px-6 py-16 text-center sm:px-10" role="status">
        <p className="text-sm text-text-muted">Loading the quiz…</p>
      </div>
    ),
  }
);

export function QuizClient({
  campaignOpen: openAtRender,
  serverNowMs,
}: {
  campaignOpen: boolean;
  serverNowMs: number;
}) {
  const top = QUIZ_TIERS.reduce((best, tier) => (tier.percent > best.percent ? tier : best));

  /**
   * The window is judged from the **server's** clock, not the visitor's.
   *
   * The page is `force-dynamic`, so `openAtRender`/`serverNowMs` are
   * per-request truths; the hook counts only *elapsed* time from there, so a
   * device with a fast clock can no longer close an offer the server still
   * honours (and a slow one cannot extend it). On 1 December a stale render
   * would otherwise pitch "score 8 or more and take 40% off" directly above a
   * box saying the quiz has closed — the pitch is the part a visitor reads
   * first, and it would be the part that lied. Anchoring on the server answer
   * means the copy can only ever be too pessimistic for the few frames before
   * hydration, never too generous.
   */
  const campaignOpen = useCampaignOpenOnServerClock(openAtRender, serverNowMs);

  if (!campaignOpen) {
    return (
      <div className="mx-auto w-full max-w-xl text-center">
        <h1 className="font-display text-4xl leading-tight text-text-primary sm:text-5xl">
          The Diljit Aura quiz
        </h1>
        <p className="mt-4 text-text-muted">
          This quiz has closed. The {CAMPAIGN.tourName} codes stopped working on{' '}
          {campaignEndsLabel()}. Follow along for the next one — there is always another show.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* The masthead and the pitch are server-rendered so the URL is worth
          sharing and worth indexing: someone opening a link sees what the quiz
          is before the client half loads. The runner inside the card renders no
          masthead of its own — that would stack two of the same band. */}
      <QuizMasthead headingLevel="h1" />

      <p className="mt-4 text-center text-text-muted">
        {QUIZ_QUESTION_COUNT} questions, easy to hard, on the {CAMPAIGN.tourName} stop at{' '}
        {CAMPAIGN.venue}. Score {top.minCorrect} or more and you take{' '}
        <span className="font-semibold text-text-primary">{top.percent}% off</span> Diljit Dosanjh
        styles.
      </p>

      <div className="mt-8 rounded-[2px] border border-border-default bg-surface-card">
        <QuizRunner variant="page" trigger="direct" />
      </div>
    </div>
  );
}
