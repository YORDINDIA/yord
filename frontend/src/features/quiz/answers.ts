import 'server-only';

import { QUIZ_QUESTION_COUNT, QUIZ_QUESTIONS, type QuizQuestion } from './questions';

/**
 * The answer key, and the reason this module starts with `import 'server-only'`.
 *
 * `server-only` makes any client-component import a **build error**, not a
 * silent bundle leak, so the key cannot end up in the browser chunk by accident
 * the way it would if this were a plain export in `questions.ts`. Everything
 * that reads it — `/api/quiz/answer`, `/api/quiz/complete`, the test suite —
 * runs on the server.
 *
 * `correct` is an index into the question's own `options`, and the positions are
 * deliberately spread across all four (see the note in `questions.ts`): an
 * answer key whose entries were all `0` would hand the 40% tier to anyone who
 * pressed the first button ten times. `quiz.test.ts` asserts the spread, so an
 * edit that reorders options without re-pointing this key fails the suite rather
 * than quietly marking the right answer wrong.
 *
 * What this does *not* defend against: a shopper who calls `/api/quiz/answer`
 * ten times to learn the key. That is inherent to per-question feedback, and it
 * costs more effort than reading the answers on Wikipedia, which they could
 * already do. The bar this file clears is "not in the bundle", which is what
 * stops a shared answer list from handing the whole 40% tier to everyone.
 */
export interface QuizAnswer {
  /** Index into the question's `options`. */
  correct: number;
  /** Shown after the answer, right or wrong. */
  fact: string;
}

export const QUIZ_ANSWER_KEY: Readonly<Record<string, QuizAnswer>> = {
  q1: {
    correct: 1,
    fact: 'He was born in Dosanjh Kalan, Punjab, and has recorded in Punjabi since 2003.',
  },
  q2: {
    correct: 2,
    fact: 'Imtiaz Ali\u2019s biopic earned him an International Emmy nomination for Best Actor.',
  },
  q3: {
    correct: 0,
    fact: 'G.O.A.T. (2020) put him on Billboard\u2019s Social 50 chart.',
  },
  q4: {
    correct: 3,
    fact: 'Coachella 2023 \u2014 the first Punjabi artist to play the festival.',
  },
  q5: {
    correct: 1,
    fact: 'Jatt & Juliet (2012) with Neeru Bajwa became one of Punjabi cinema\u2019s biggest hits.',
  },
  q6: {
    correct: 3,
    fact: 'Udta Punjab (2016) won him the Filmfare Award for Best Male Debut.',
  },
  q7: {
    correct: 0,
    fact: 'A Madame Tussauds figure in 2019 \u2014 the first turbaned Sikh to be honoured.',
  },
  q8: {
    correct: 2,
    fact: 'Ishq Da Uda Ada, released in 2003 on Finetone Cassettes. The label asked him to spell his name "Diljit" rather than "Daljit".',
  },
  q9: {
    correct: 1,
    fact: 'Punjab 1984 won the National Film Award for Best Feature Film in Punjabi.',
  },
  q10: {
    correct: 2,
    fact: '"Kharku" took Best Bhangra Song of the Year at both award shows.',
  },
};

/**
 * The key entry for a question, or `undefined` when the id is unknown.
 *
 * A missing entry must never read as "option 0 is correct": the caller has to
 * treat `undefined` as a rejection, or a question added to `questions.ts`
 * without a matching answer would silently mark every player wrong on it. The
 * test suite asserts the two files agree for exactly this reason.
 */
export function answerFor(questionId: string): QuizAnswer | undefined {
  return Object.prototype.hasOwnProperty.call(QUIZ_ANSWER_KEY, questionId)
    ? QUIZ_ANSWER_KEY[questionId]
    : undefined;
}

/** The question an id names, or `undefined`. */
export function questionFor(questionId: string): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((question) => question.id === questionId);
}

/**
 * Whether one submitted choice is right. `undefined` for an unknown question id
 * so the route can answer 400 instead of scoring it as wrong.
 */
export function isCorrectChoice(questionId: string, choice: number): boolean | undefined {
  const answer = answerFor(questionId);
  if (!answer) return undefined;
  return answer.correct === choice;
}

/**
 * Whether a submission is *exactly one answer per question of the set* — every
 * id known, no id repeated, nothing missing.
 *
 * `scoreSubmission` counts each matching entry, so without this gate a crafted
 * body repeating one easy question's correct choice ten times would score
 * 10/10 and mint the top tier. The route rejects anything this returns false
 * for (a 400, not a bronze): the client always sends the full set, so anything
 * else is not a slow player but a hand-built payload.
 */
export function submissionCoversQuestionSet(
  answers: readonly { questionId: string }[]
): boolean {
  if (answers.length !== QUIZ_QUESTION_COUNT) return false;
  const seen = new Set<string>();
  for (const { questionId } of answers) {
    if (seen.has(questionId)) return false;
    if (!answerFor(questionId)) return false;
    seen.add(questionId);
  }
  return seen.size === QUIZ_QUESTION_COUNT;
}

/**
 * Score a full submission. The server recomputes from this key rather than
 * trusting the tally the client sends back: the client's running count is a
 * display detail, and the number that picks a reward tier must come from here.
 *
 * Ids the key does not know, and choices that are not integers in range, count
 * as wrong rather than throwing — a malformed submission earns bronze, never a
 * 500 on a shopper's screen. Callers gate on `submissionCoversQuestionSet`
 * first so the "wrong" fallback cannot be farmed with duplicates.
 */
export function scoreSubmission(answers: readonly { questionId: string; choice: number }[]): number {
  let correct = 0;
  for (const { questionId, choice } of answers) {
    const answer = answerFor(questionId);
    if (!answer) continue;
    if (!Number.isInteger(choice)) continue;
    if (choice < 0 || choice >= (questionFor(questionId)?.options.length ?? 0)) continue;
    if (answer.correct === choice) correct += 1;
  }
  return correct;
}
