import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIp, isRateLimited, rateLimitResponse } from '@/lib/rate-limit';
import { logDbError, logWarn } from '@/lib/logger';
import { QUIZ_QUESTION_COUNT } from '@/features/quiz/questions';
import { CAMPAIGN, campaignIsOpen, tierForScore } from '@/features/quiz/config';
import { generateCode } from '@/features/quiz/codes';
import { scoreSubmission, submissionIsWellFormed } from '@/features/quiz/answers';

/**
 * Mint (or re-return) the code a player earned.
 *
 * `POST /api/quiz/complete`
 *   body  { sid: uuid, answers: [{ questionId, choice }] }
 *   200   { code, percent, correct, total, tier }
 *   400   malformed body
 *   410   the campaign has closed
 *   429   rate limited
 *
 * Two things here are deliberately server-side:
 *
 * 1. **The score.** The client keeps its own running tally for the progress
 *    bar, but the number that picks a tier is recomputed from `answers.ts`, so
 *    a tampered submission earns the tier its real answers deserve.
 * 2. **The code.** Minted here, never on the client, and returned again on a
 *    replay so a refresh does not cost the player their reward.
 *
 * The rate limit is per IP and is the only thing bounding how many codes one
 * person can farm — a fresh `sid` is one `localStorage.clear()` away, so
 * `sid` is a convenience key (one code per browser), not an anti-abuse control.
 * Five an hour means a hundred codes would take a day of sustained requests,
 * which is the intended cost for a five-day campaign. Tightening it further
 * would start refusing shared campus and office IPs.
 */

const SID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_ANSWERS = QUIZ_QUESTION_COUNT;

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  return createClient(url, secretKey);
}

type SubmittedAnswer = { questionId: string; choice: number };

/**
 * Shape-check the submission, then require *at most one answer per question*
 * (`submissionIsWellFormed`). The length cap alone is not enough: ten copies of
 * one easy question fit inside it, and `scoreSubmission` counts each match, so
 * duplicates could mint a tier the real answers never earned. A partial set is
 * fine — the round clock submits whatever was answered when it expires, and
 * absent questions score as wrong — so only duplicates, unknown ids and
 * over-long bodies answer 400.
 */
function readAnswers(input: unknown): SubmittedAnswer[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ANSWERS) return null;
  const answers: SubmittedAnswer[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') return null;
    const { questionId, choice } = entry as { questionId?: unknown; choice?: unknown };
    if (typeof questionId !== 'string' || questionId.length > 64) return null;
    if (typeof choice !== 'number' || !Number.isInteger(choice)) return null;
    answers.push({ questionId, choice });
  }
  if (!submissionIsWellFormed(answers)) return null;
  return answers;
}

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(`quiz-complete:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
      return rateLimitResponse();
    }

    const supabase = getClient();
    if (!supabase) {
      logWarn('quiz-complete', 'MISCONFIGURED', 'Missing Supabase env vars');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const sid = typeof body?.sid === 'string' && SID_SHAPE.test(body.sid) ? body.sid : null;
    const answers = readAnswers(body?.answers);

    if (!sid || !answers) {
      return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
    }

    if (!campaignIsOpen()) {
      // `reason`, not `code`: in this route `code` is the promo code, and a
      // 410 whose `code` field held `'CAMPAIGN_CLOSED'` would be a trap for the
      // next reader — and would look like a real code to a client that only
      // checked for one.
      return NextResponse.json(
        { error: 'This quiz has closed. Look out for the next one.', reason: 'CAMPAIGN_CLOSED' },
        { status: 410 }
      );
    }

    // Already played: hand back the same code rather than minting a second one.
    // The unique index on `sid` would reject the insert anyway, and a 500 on a
    // refresh would read as "the quiz is broken" to a player who already won.
    const { data: existing, error: existingError } = await supabase
      .from('quiz_codes')
      .select('code, percent, correct, total')
      .eq('sid', sid)
      .maybeSingle();
    if (existingError) {
      logDbError('quiz-complete:existing-read', existingError);
      return NextResponse.json({ error: 'Could not load your code' }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json({
        code: existing.code,
        percent: existing.percent,
        correct: existing.correct,
        total: existing.total,
        tier: tierForScore(existing.correct).id,
        returning: true,
      });
    }

    const correct = scoreSubmission(answers);
    const tier = tierForScore(correct);

    // Two unique indexes can reject this insert, and they mean different things:
    //
    //   `sid`    — a concurrent request with the same `sid` won the race. Re-read
    //              rather than retrying: the other request already produced the
    //              code this player should see.
    //   `code`   — the random `AURA-XXXXXX` drew a code that already exists
    //              (~1e9 space, so rare but real). Regenerate and retry, so a
    //              valid quiz completion is never stranded on a collision.
    //
    // The re-read distinguishes them: a `sid` row exists only in the first case.
    const MINT_ATTEMPTS = 3;
    let inserted: { code: string; percent: number; correct: number; total: number } | null = null;
    let insertError: unknown = null;
    for (let attempt = 0; attempt < MINT_ATTEMPTS && !inserted; attempt += 1) {
      const result = await supabase
        .from('quiz_codes')
        .insert({
          code: generateCode(),
          sid,
          percent: tier.percent,
          correct,
          total: QUIZ_QUESTION_COUNT,
        })
        .select('code, percent, correct, total')
        .maybeSingle();
      inserted = result.data;
      insertError = result.error;
      if (result.error?.code !== '23505') break;

      const { data: raced } = await supabase
        .from('quiz_codes')
        .select('code, percent, correct, total')
        .eq('sid', sid)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({
          code: raced.code,
          percent: raced.percent,
          correct: raced.correct,
          total: raced.total,
          tier: tierForScore(raced.correct).id,
          returning: true,
        });
      }
      // Not the `sid` race — the code collided. Loop with a fresh code.
    }

    if (!inserted) {
      logDbError('quiz-complete:insert', insertError);
      return NextResponse.json({ error: 'Could not issue your code' }, { status: 500 });
    }

    logWarn(
      'quiz-complete',
      'CODE_MINTED',
      `percent=${inserted.percent} correct=${inserted.correct} concert=${CAMPAIGN.concertDate}`
    );

    return NextResponse.json({
      code: inserted.code,
      percent: inserted.percent,
      correct: inserted.correct,
      total: inserted.total,
      tier: tier.id,
      returning: false,
    });
  } catch (error) {
    logDbError('quiz-complete', error);
    return NextResponse.json({ error: 'Could not issue your code' }, { status: 500 });
  }
}
