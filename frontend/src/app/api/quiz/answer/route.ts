import { NextRequest, NextResponse } from 'next/server';
import { clientIp, isRateLimited, rateLimitResponse } from '@/lib/rate-limit';
import { QUIZ_OPTION_COUNT } from '@/features/quiz/questions';
import { answerFor, questionFor } from '@/features/quiz/answers';

/**
 * Score one answer, so the question card can say right or wrong immediately
 * without the answer key ever reaching the browser.
 *
 * `POST /api/quiz/answer`
 *   body  { questionId: string, choice: number }
 *   200   { correct, correctChoice, fact }
 *   400   malformed body, or a question id the key does not know
 *   429   rate limited
 *
 * The alternative — shipping the key and scoring in the browser — is one fewer
 * round trip and one open door: a 40%-off code for anyone who greps the bundle
 * and posts the answers. A request per question is the price of that door
 * staying shut, and the payload is a few hundred bytes.
 *
 * The limit is loose (60 a minute) because this route mints nothing and moves
 * no money; it only tells a player what they already tried to answer. Learning
 * the key through it takes ten calls and is no cheaper than looking the answers
 * up, which was always possible.
 */

export async function POST(request: NextRequest) {
  if (isRateLimited(`quiz-answer:${clientIp(request)}`, 60, 60 * 1000)) {
    return rateLimitResponse();
  }

  const body = await request.json().catch(() => null);
  const questionId = typeof body?.questionId === 'string' ? body.questionId : null;
  const choice = typeof body?.choice === 'number' && Number.isInteger(body.choice) ? body.choice : null;

  if (!questionId || questionId.length > 64 || choice === null) {
    return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
  }

  // An unknown id is a 400, not "wrong": a question added to `questions.ts`
  // without a key entry should fail loudly in the console rather than mark every
  // player wrong on a card nobody can get right.
  const question = questionFor(questionId);
  const answer = answerFor(questionId);
  if (!question || !answer) {
    return NextResponse.json({ error: 'Unknown question' }, { status: 400 });
  }

  if (choice < 0 || choice >= QUIZ_OPTION_COUNT || choice >= question.options.length) {
    return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
  }

  return NextResponse.json({
    correct: answer.correct === choice,
    correctChoice: answer.correct,
    fact: answer.fact,
  });
}
