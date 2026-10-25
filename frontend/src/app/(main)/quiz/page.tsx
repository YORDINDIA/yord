import type { Metadata } from 'next';
import { QuizClient } from './QuizClient';
import {
  CAMPAIGN,
  QUIZ_TIERS,
  campaignEndsLabel,
  campaignIsOpen,
  serverNow,
} from '@/features/quiz/config';
import { QUIZ_QUESTION_COUNT } from '@/features/quiz/questions';

const top = QUIZ_TIERS.reduce((best, tier) => (tier.percent > best.percent ? tier : best));

/**
 * `/quiz` — the shareable URL for the Diljit Aura quiz.
 *
 * The pop-up is an interruption: it appears once per tab session, it can be
 * dismissed twice into a two-week silence, and it never appears at all on a buy
 * page. None of that works for a link someone wants to send to a friend, or for
 * a caption on an Instagram post, or for the one person who dismissed it by
 * reflex and then changed their mind. This route is the same ten questions with
 * no gate in front of them.
 *
 * It is deliberately **not** a second quiz. The same `QuizRunner` drives both,
 * the same `/api/quiz/complete` mints the code, and one browser still gets one
 * code: opening this page after playing shows the code you already have rather
 * than a fresh set of questions. A shared link cannot mint a second code for
 * the `sid` that already owns one — clearing storage mints a fresh `sid` and a
 * fresh code, which is what the mint route's per-IP rate limit is there to
 * bound — and a visitor cannot be confused about which of two quizzes is real.
 *
 * Indexable on purpose. It is a legitimate campaign page with real content, it
 * is how a search for "diljit quiz" finds the offer, and it is not thin — but
 * `robots` follows the campaign window: once the codes stop working the page
 * says so, and a closed offer in the index is a worse result than no result.
 *
 * **`force-dynamic` is load-bearing, and it is the only reason the window is
 * read at request time.** Reading a clock in `generateMetadata` does not make a
 * route dynamic — Next.js will happily prerender it and evaluate
 * `campaignIsOpen()` once, at build. The campaign ends on 30 November; without
 * this line the page would keep advertising 40% off, and keep telling Google to
 * index it, for as long as the build that shipped it stayed deployed. The page
 * is a heading and a client island with no data fetching, so per-request
 * rendering costs a render and nothing else.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const open = campaignIsOpen();

  return {
    title: `The ${CAMPAIGN.artistName} Quiz — Win up to ${top.percent}% Off`,
    description: `How big a Diljit Dosanjh fan are you? Answer ${QUIZ_QUESTION_COUNT} questions, easy to hard, and win up to ${top.percent}% off Diljit Dosanjh styles. One code per visitor, valid until ${campaignEndsLabel()}.`,
    alternates: { canonical: '/quiz' },
    robots: open ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `The ${CAMPAIGN.artistName} Quiz — up to ${top.percent}% off`,
      description: `${QUIZ_QUESTION_COUNT} questions on the ${CAMPAIGN.tourName} stop at ${CAMPAIGN.venue}, ${CAMPAIGN.city}. Score ${top.minCorrect}+ for ${top.percent}% off Diljit Dosanjh styles.`,
      type: 'website',
      url: '/quiz',
    },
  };
}

export default function QuizPage() {
  return (
    <div className="min-h-screen bg-surface-page pb-20 pt-32">
      <div className="px-6 lg:px-12">
        {/* The server's answer plus the server's clock, so the pitch above the
            quiz is right in the first paint and the client half can count the
            window down from an authoritative start rather than the visitor's
            wall clock (which a fast device would use to close the offer
            early). */}
        <QuizClient campaignOpen={campaignIsOpen()} serverNowMs={serverNow()} />
      </div>
    </div>
  );
}
