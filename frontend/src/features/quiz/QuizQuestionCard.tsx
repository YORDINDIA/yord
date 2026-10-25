'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@yord/ui';
import { LEVEL_LABEL, QUIZ_QUESTION_COUNT, promptParts, type QuizQuestion } from './questions';

/**
 * One question, its four options, and the right/wrong reveal.
 *
 * Feedback comes from `/api/quiz/answer` rather than from the browser, which is
 * the trade this component makes: one small request per question, in exchange
 * for the answer key never being in the bundle. The choice is painted as
 * selected immediately and the verdict lands when the response does, so the
 * button never feels dead on a slow connection.
 *
 * Keyboard: 1–4 pick an option, and the options are real `<button>`s so Tab and
 * Enter work without a handler. The auto-advance is the parent's, so this card
 * only reports the verdict once and stays out of the flow.
 */

interface QuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  /** Called exactly once per question, with the verdict and the chosen index. */
  onAnswered: (correct: boolean, choice: number) => void;
}

interface Verdict {
  correct: boolean;
  correctChoice: number;
  fact: string;
}

export function QuizQuestionCard({ question, index, onAnswered }: QuizQuestionCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pending, setPending] = useState(false);
  // A ref, not state: `answer` reads it to guarantee the verdict is reported
  // exactly once, and a re-render must not reset that guarantee.
  const reported = useRef(false);
  // The in-flight answer request. Aborted on unmount so a popup dismissed while
  // a verdict is in flight can never resolve into `onAnswered` — that callback
  // is what advances (and eventually submits) the quiz, and firing it from a
  // card that is no longer on screen would keep a closed popup playing.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const answer = useCallback(
    async (choice: number) => {
      if (selected !== null || pending) return;
      setSelected(choice);
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let result: Verdict;
      try {
        const response = await fetch('/api/quiz/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: question.id, choice }),
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as Partial<Verdict>;
        result =
          typeof data.correct === 'boolean' && typeof data.correctChoice === 'number'
            ? { correct: data.correct, correctChoice: data.correctChoice, fact: data.fact ?? '' }
            : // A failed check must not block the quiz: assume wrong and move on.
              // The server rescores the whole submission at the end, so a network
              // hiccup here costs the player a fact line, never a tier.
              { correct: false, correctChoice: -1, fact: '' };
      } catch {
        if (controller.signal.aborted) return; // the card is gone; nobody is listening
        result = { correct: false, correctChoice: -1, fact: '' };
      }

      setVerdict(result);
      setPending(false);
      // Once, and only once: the parent records the choice and tallies the score
      // from these calls. Reporting again on the advance timer would submit the
      // answer twice.
      if (!reported.current) {
        reported.current = true;
        onAnswered(result.correct, choice);
      }
    },
    [onAnswered, pending, question.id, selected]
  );

  // 1-4 select an option. Bound to the document so the player does not have to
  // focus the card first, and ignored while a modifier is held so browser
  // shortcuts keep working — and ignored while the visitor is typing in any
  // field (search, newsletter), where a digit belongs to the text and the
  // default must not be swallowed.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const digit = Number(event.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > question.options.length) return;
      event.preventDefault();
      void answer(digit - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [answer, question.options.length]);

  return (
    <div className="quiz-card-in px-6 pb-8 pt-8 sm:px-10">
      <div className="flex items-center justify-between">
        <span className="font-accent text-sm tracking-[0.2em] text-text-muted">
          {String(index + 1).padStart(2, '0')} / {QUIZ_QUESTION_COUNT}
        </span>
        <span className="font-accent text-xs tracking-[0.15em] text-text-muted">
          {LEVEL_LABEL[question.level]}
        </span>
      </div>

      {/* Progress, as a rule rather than a bar: it reads as a chapter marker and
          costs no layout shift as it fills. The announced value follows the
          visual fill — one notch once this question is settled. */}
      <div
        className="mt-3 h-px w-full bg-border-default"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={QUIZ_QUESTION_COUNT}
        aria-valuenow={index + (verdict ? 1 : 0)}
        aria-label={`Question ${index + 1} of ${QUIZ_QUESTION_COUNT}`}
      >
        <div
          className="h-px bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${((index + (verdict ? 1 : 0)) / QUIZ_QUESTION_COUNT) * 100}%` }}
        />
      </div>

      <h2 className="mt-6 font-display text-2xl leading-snug text-text-primary sm:text-3xl">
        {promptParts(question.prompt).map((part, i) =>
          part.em ? (
            <em key={i} className="italic text-accent">
              {part.text}
            </em>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </h2>

      <div className="mt-6 space-y-2.5">
        {question.options.map((option, optionIndex) => {
          const isSelected = selected === optionIndex;
          const isAnswer = verdict !== null && verdict.correctChoice === optionIndex;
          const isWrongPick = verdict !== null && isSelected && !verdict.correct;

          return (
            <button
              key={option}
              type="button"
              onClick={() => void answer(optionIndex)}
              disabled={selected !== null}
              className={cn(
                'group flex w-full items-center justify-between gap-3 rounded-[2px] border px-4 py-3.5 text-left text-sm transition-colors duration-200',
                'min-h-[44px] disabled:cursor-default',
                // Before an answer: quiet, hoverable, one clear edge — and the
                // pick already reads as taken while its verdict is in flight.
                verdict === null &&
                  !isSelected &&
                  'border-border-default bg-surface-card text-text-secondary hover:border-border-strong hover:bg-surface-raised',
                verdict === null &&
                  isSelected &&
                  'border-border-strong bg-surface-raised text-text-primary',
                // After: the right answer is marked, the wrong pick is not.
                isAnswer && 'border-accent bg-accent-tint text-text-primary',
                isWrongPick && 'border-border-default bg-surface-inset text-text-muted',
                verdict !== null && !isAnswer && !isWrongPick && 'border-border-default text-text-muted'
              )}
              aria-pressed={isSelected}
            >
              <span className="flex items-baseline gap-3">
                <span
                  className={cn(
                    'font-accent text-xs tracking-widest transition-colors',
                    isSelected || isAnswer
                      ? 'text-accent'
                      : cn('text-text-subtle', verdict === null && 'group-hover:text-accent')
                  )}
                >
                  {optionIndex + 1}
                </span>
                <span>{option}</span>
              </span>
              {isAnswer ? (
                <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              ) : isWrongPick ? (
                <X className="h-4 w-4 shrink-0 text-text-subtle" aria-hidden="true" />
              ) : pending && isSelected ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-subtle" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* The verdict line keeps its room reserved so the card does not jump when
          it lands; until then the row carries the keyboard hint, which retires
          the moment a choice is made. The hint is decorative (the keys still
          work either way), so it is hidden from assistive tech. */}
      <div className="mt-4 flex min-h-[3.5rem] items-start justify-between gap-4">
        <div aria-live="polite">
          {verdict ? (
            <p className="text-sm text-text-muted">
              <span className={cn('font-semibold', verdict.correct ? 'text-success' : 'text-danger')}>
                {verdict.correct ? 'Correct. ' : 'Not quite. '}
              </span>
              {verdict.fact}
            </p>
          ) : null}
        </div>
        {selected === null ? (
          <p
            aria-hidden="true"
            className="hidden shrink-0 font-accent text-[10px] tracking-[0.25em] text-text-muted sm:block"
          >
            PRESS 1–4 TO ANSWER
          </p>
        ) : null}
      </div>
    </div>
  );
}
