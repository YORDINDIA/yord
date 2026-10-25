'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/features/ui/Button';
import { usePromoStore } from '@/lib/stores/promoStore';
import { analyticsSessionId, track } from '@/lib/analytics/track';
import { QUIZ_PERCENTAGES } from './config';
import { QUIZ_QUESTIONS } from './questions';
import { QuizIntro } from './QuizIntro';
import { QuizMasthead } from './QuizMasthead';
import { QuizQuestionCard } from './QuizQuestionCard';
import { QuizResultView } from './QuizResultView';
import { useQuizHydrated, useQuizStore, type QuizResult } from './quizStore';
import { readMintResponse } from './mint';
import { useCampaignOpen } from './useCountdown';
import type { QuizTrigger } from './gateRules';

/**
 * The quiz itself: intro → ten questions → result. One machine, two frames.
 *
 * The pop-up and `/quiz` are the same ten questions with the same code at the
 * end, so they share this component rather than a copy of the flow. Only the
 * frame differs: the pop-up wraps it in `Overlay` and adds a close button; the
 * page gives it a headline and a column. Duplicating the machine would mean two
 * places to fix the next time a rule changes, and the money-relevant parts
 * (which answers are submitted, when a result is persisted, whether the code is
 * auto-applied) are exactly the parts that must not drift.
 *
 * Scoring is client-side *for display only*. Each answer's verdict comes from
 * `/api/quiz/answer`, this component tallies them for the progress copy, and the
 * number that picks the tier is recomputed server-side by `/api/quiz/complete`
 * from the submitted choices. A tampered tally changes the screen, not the
 * reward.
 */

/** How long the verdict stays up before the next question. */
const ADVANCE_MS = 1_600;
/** The beat before the reveal, so the result lands as a moment. */
const REVEAL_MS = 700;

type Phase = 'intro' | 'quiz' | 'submitting' | 'result';

/** The screen the runner is showing. Exported so a frame can react to it. */
export type QuizPhase = Phase;

export interface QuizRunnerProps {
  /**
   * `popup` renders a close button; `page` is the `/quiz` route, where closing
   * is just navigating away and there is nothing to dismiss.
   */
  variant: 'popup' | 'page';
  /** What surfaced the quiz, carried into `quiz_viewed`. */
  trigger: QuizTrigger;
  /** Called when the visitor closes the pop-up. Ignored by `page`. */
  onClose?: () => void;
  /**
   * The screen now showing, reported on every change. The pop-up needs it to
   * tell a dismissal (closed before earning a code) from someone closing the
   * result screen with their code in hand — and it needs that for *every* close
   * path, including Escape and a backdrop click, which `Overlay` handles without
   * the runner seeing them. Reporting the screen upward is what lets one handler
   * cover all three, and it is why the pop-up, not this component, fires
   * `quiz_dismissed`.
   */
  onPhaseChange?: (phase: QuizPhase) => void;
}

export function QuizRunner({ variant, trigger, onClose, onPhaseChange }: QuizRunnerProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The server refused to mint a code because the campaign window has passed.
   * Separate from the `campaignOpen` check below, which reads this device's
   * clock: a wrong clock cannot be trusted to say the quiz is over, and the
   * answer key cannot be asked twice.
   */
  const [closed, setClosed] = useState(false);

  const hydrated = useQuizHydrated();
  const campaignOpen = useCampaignOpen();
  const storedCompleted = useQuizStore((state) => state.completed);
  const storedResult = useQuizStore((state) => state.result);
  const setStoredResult = useQuizStore((state) => state.setResult);
  const applyKnown = usePromoStore((state) => state.applyKnown);

  // The submission payload, in a ref so `submit` reads the complete list even
  // when it fires from a timer rather than from the last answer's handler.
  const answersRef = useRef<{ questionId: string; choice: number }[]>([]);
  // Mirrors `answersRef` for the running tally, without re-creating `onAnswered`
  // on every answer.
  const scoreRef = useRef(0);
  const advanceTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);
  const submitted = useRef(false);
  // `quiz_viewed` fires once per mount, not once per render.
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track({ type: 'quiz_viewed', trigger });
  }, [trigger]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    };
  }, []);

  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setPhase('submitting');
    setError(null);

    try {
      const response = await fetch('/api/quiz/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The analytics session id, reused so one browser maps to one code.
          // It is a random per-browser uuid, never joined to a customer.
          sid: analyticsSessionId(),
          // Only the choices are sent. The score is not: the route recomputes it
          // from the answer key, so there is nothing here to inflate.
          answers: answersRef.current,
        }),
      });
      const outcome = readMintResponse(await response.json().catch(() => null), scoreRef.current);

      // The client clock said the campaign was open, the server disagreed — a
      // skewed device clock, or a tab left open past the deadline. The closed
      // screen is the honest answer, and the answer key is the only thing
      // allowed to decide it.
      if (outcome.kind === 'closed') {
        setClosed(true);
        return;
      }

      if (outcome.kind === 'error') {
        setError(outcome.message);
        setPhase('quiz');
        // Let them try again: the answers are still in the refs, so a retry is
        // one tap rather than another ten questions.
        submitted.current = false;
        return;
      }

      const earned = outcome.result;

      setResult(earned);
      setStoredResult(earned);
      track({
        type: 'quiz_completed',
        correct: earned.correct,
        total: earned.total,
        // The ladder is `10 | 20 | 40`, and `0` is reserved for a percent the
        // client does not recognise — a value this build cannot label should
        // not be filed under one it can. Bronze's 10% means nobody who finishes
        // goes without a code, so `0` is not a "scored too low" outcome.
        percent: (QUIZ_PERCENTAGES as readonly number[]).includes(earned.percent)
          ? (earned.percent as 0 | 10 | 20 | 40)
          : 0,
      });
      // Auto-applied: a code is worth nothing until it reaches the cart, and
      // making a shopper retype a code they just earned is friction with no
      // upside. It stays editable in the cart.
      applyKnown(earned.code, earned.percent);

      // The pause before the reveal. Nothing waits on it — the code is already
      // in hand — so it is pure presentation and skipped under reduced motion.
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      revealTimer.current = window.setTimeout(
        () => setPhase('result'),
        reduceMotion ? 0 : REVEAL_MS
      );
    } catch {
      setError('Could not issue your code. Please try again.');
      setPhase('quiz');
      submitted.current = false;
    }
  }, [applyKnown, setStoredResult]);

  const onAnswered = useCallback(
    (isCorrect: boolean, choice: number) => {
      const question = QUIZ_QUESTIONS[index];
      if (!question) return;

      answersRef.current = [...answersRef.current, { questionId: question.id, choice }];
      if (isCorrect) scoreRef.current += 1;

      advanceTimer.current = window.setTimeout(() => {
        if (index + 1 >= QUIZ_QUESTIONS.length) void submit();
        else setIndex(index + 1);
      }, ADVANCE_MS);
    },
    [index, submit]
  );

  const start = useCallback(() => {
    track({ type: 'quiz_started' });
    setPhase('quiz');
  }, []);

  /**
   * A visitor who already played sees their code, not the intro.
   *
   * `phase` starts at `intro` on a fresh load, and the persisted store hydrates
   * a frame later — so this is derived rather than seeded into `useState`, which
   * would read the store before it had loaded and show the intro anyway. The
   * server snapshot for `hydrated` is false, so the server and the first client
   * render agree on the intro and the result replaces it on hydration.
   *
   * Replaying cannot improve the reward — one code per browser, re-returned by
   * `/api/quiz/complete` — so sending them back through ten questions would
   * cost them a minute to change nothing.
   */
  const storedScreen: Phase =
    hydrated && storedCompleted && storedResult ? 'result' : 'intro';
  const screen: Phase = phase === 'intro' ? storedScreen : phase;
  const shownResult = result ?? storedResult;

  /**
   * Report the screen actually on show — `screen`, not `phase`.
   *
   * A returning visitor's `phase` state is still `intro` while the derived
   * `screen` is `result`. The pop-up counts a close as a rejection only from
   * `intro` or `quiz`, so reporting the raw phase would log "dismissed" every
   * time a shopper closed the panel on the code they had already earned.
   *
   * Declared before the campaign-closed return below: a hook cannot sit after
   * an early return.
   */
  useEffect(() => {
    onPhaseChange?.(screen);
  }, [onPhaseChange, screen]);

  // The campaign window, checked here as well as in the routes. The routes are
  // authoritative — they check per request — but letting someone answer ten
  // questions and then telling them the quiz closed is a bad minute to waste.
  // `closed` covers the case where only the server knew: the clock on the device
  // said open, the mint said no.
  if (closed || !campaignOpen) {
    return (
      <div className="relative">
        {variant === 'popup' ? (
          <>
            <button
              type="button"
              onClick={close}
              aria-label="Close the quiz"
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center text-text-on-media-muted transition-colors hover:text-text-on-media"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <QuizMasthead headingLevel="h2" titleId="quiz-title" />
          </>
        ) : null}
        <div className="px-6 py-14 text-center sm:px-10">
          <h3 className="font-display text-2xl text-text-primary">This quiz has closed</h3>
          <p className="mt-3 text-text-muted">
            The Aura tour quiz is over. Follow along for the next one — there is always another show.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {variant === 'popup' ? (
        <>
          {/* Over the masthead's art, so the on-media tokens — the close
              control must stay legible in both themes. */}
          <button
            type="button"
            onClick={close}
            aria-label="Close the quiz"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center text-text-on-media-muted transition-colors hover:text-text-on-media"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* The dialog's accessible name comes from the masthead's `h2` — the
              visible title and the label are one element, not two. The page
              variant renders its own masthead above the card (its `h1` must be
              server-rendered for the shareable URL), so only the pop-up's
              runner carries one. */}
          <QuizMasthead headingLevel="h2" titleId="quiz-title" />
        </>
      ) : null}

      {screen === 'intro' ? <QuizIntro onStart={start} /> : null}

      {screen === 'quiz' || screen === 'submitting' ? (
        // The key is load-bearing: every per-question piece of state
        // (`selected`, `verdict`, the once-only `reported` ref) lives inside
        // the card, so the card must remount per question or question 1's
        // answer leaks into every later one — selected, disabled, and
        // unanswerable. Question ids are unique (`quiz.test.ts` asserts it).
        <QuizQuestionCard
          key={QUIZ_QUESTIONS[index].id}
          question={QUIZ_QUESTIONS[index]}
          index={index}
          onAnswered={onAnswered}
        />
      ) : null}

      {screen === 'submitting' ? (
        <p
          aria-live="polite"
          className="flex items-center justify-center gap-2 px-6 pb-6 sm:px-10"
        >
          <Loader2
            className="h-4 w-4 animate-spin text-accent motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="font-accent text-xs tracking-[0.2em] text-text-muted">
            CHECKING YOUR SCORE…
          </span>
        </p>
      ) : null}

      {error ? (
        <div className="px-6 pb-6 text-center sm:px-10">
          <p role="alert" className="text-sm text-text-primary">
            {error}
          </p>
          {/* The only way back into `submit`: the last question's card is
              fully answered and disabled, so without this button a failed
              mint strands every answer with no retry. */}
          <Button onClick={() => void submit()} variant="secondary" className="mt-4">
            Try again
          </Button>
        </div>
      ) : null}

      {screen === 'result' && shownResult ? <QuizResultView result={shownResult} /> : null}
    </div>
  );
}
