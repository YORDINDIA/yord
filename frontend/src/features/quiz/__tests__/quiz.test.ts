import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN,
  QUIZ_PERCENTAGES,
  QUIZ_TIERS,
  campaignEndsLabel,
  campaignIsOpen,
  tierForScore,
} from '../config';
import {
  LEVEL_LABEL,
  QUIZ_OPTION_COUNT,
  QUIZ_QUESTION_COUNT,
  QUIZ_QUESTIONS,
  promptParts,
} from '../questions';
import { QUIZ_ANSWER_KEY, answerFor, isCorrectChoice, scoreSubmission } from '../answers';
import { ALLOWED_PREFIXES, SUPPRESSED_PREFIXES, pathAllows } from '../gateRules';
import { MINT_FAILURE_MESSAGE, readMintResponse } from '../mint';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_PREFIX,
  CODE_SPACE,
  generateCode,
  isValidCodeFormat,
  normalizeCode,
} from '../codes';

/**
 * The quiz's own rules: the ramp, the reward ladder, the answer key, and the
 * code format.
 *
 * These are the parts that fail *quietly* when they break. A question with no
 * answer key entry renders a card nobody can answer; a ladder out of order
 * silently pays 40% for 8 correct and 10% for 9; a code format that drifts from
 * `AURA-` + six characters mints codes the promo field's own validator rejects.
 * None of those throw, so each one is asserted here instead.
 */

describe('the question set', () => {
  it('is ten questions, in the easy-to-hard order', () => {
    expect(QUIZ_QUESTION_COUNT).toBe(10);
    const levels = QUIZ_QUESTIONS.map((question) => question.level);
    // Non-decreasing: the ramp is the pitch, and a hard question in the middle
    // of the warm-up would read as a mistake to anyone playing.
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels[0]).toBe(1);
    expect(levels[levels.length - 1]).toBe(3);
  });

  it('has unique ids, a prompt, and exactly four options each', () => {
    const ids = QUIZ_QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const question of QUIZ_QUESTIONS) {
      expect(question.prompt.length).toBeGreaterThan(0);
      expect(question.options).toHaveLength(QUIZ_OPTION_COUNT);
      // Four distinct options, or the card renders two buttons that look alike
      // and only one of them is right.
      expect(new Set(question.options).size).toBe(QUIZ_OPTION_COUNT);
      for (const option of question.options) expect(option.length).toBeGreaterThan(0);
    }
  });

  it('labels every difficulty level', () => {
    for (const question of QUIZ_QUESTIONS) {
      expect(LEVEL_LABEL[question.level]).toBeTruthy();
    }
  });
});

describe('the answer key', () => {
  it('covers every question with an in-range option index', () => {
    // The direction that matters: a question added without an answer would
    // otherwise ship an unanswerable card.
    for (const question of QUIZ_QUESTIONS) {
      const answer = answerFor(question.id);
      expect(answer, `no answer key entry for ${question.id}`).toBeDefined();
      expect(answer!.correct).toBeGreaterThanOrEqual(0);
      expect(answer!.correct).toBeLessThan(question.options.length);
      expect(Number.isInteger(answer!.correct)).toBe(true);
      expect(answer!.fact.length).toBeGreaterThan(0);
    }
  });

  it('has no key entry for a question that does not exist', () => {
    const ids = new Set(QUIZ_QUESTIONS.map((question) => question.id));
    for (const id of Object.keys(QUIZ_ANSWER_KEY)) {
      expect(ids.has(id), `answer key has an entry for unknown question ${id}`).toBe(true);
    }
  });

  it('treats an unknown question as unknown, not as wrong', () => {
    // `undefined` rather than `false`: the route answers 400 on it, and a
    // "false" here would score a question the key does not know as a miss.
    expect(isCorrectChoice('nope', 0)).toBeUndefined();
    // Read the index from the key rather than writing a literal: the option
    // positions are spread on purpose and do move.
    const right = answerFor('q1')!.correct;
    expect(isCorrectChoice('q1', right)).toBe(true);
    expect(isCorrectChoice('q1', (right + 1) % QUIZ_OPTION_COUNT)).toBe(false);
  });

  it('scores a full correct submission at the top of the ladder', () => {
    const answers = QUIZ_QUESTIONS.map((question) => ({
      questionId: question.id,
      choice: answerFor(question.id)!.correct,
    }));
    expect(scoreSubmission(answers)).toBe(QUIZ_QUESTION_COUNT);
    expect(tierForScore(scoreSubmission(answers)).percent).toBe(40);
  });

  it('scores a submission of wrong choices at zero', () => {
    const answers = QUIZ_QUESTIONS.map((question) => ({
      questionId: question.id,
      choice: (answerFor(question.id)!.correct + 1) % question.options.length,
    }));
    expect(scoreSubmission(answers)).toBe(0);
    expect(tierForScore(0).percent).toBe(10);
  });

  it('counts a malformed submission as wrong rather than throwing', () => {
    // A tampered or truncated body must earn bronze, never a 500 on a
    // shopper's screen.
    expect(
      scoreSubmission([
        { questionId: 'nope', choice: 0 },
        { questionId: 'q1', choice: 99 },
        { questionId: 'q2', choice: -1 },
        { questionId: 'q3', choice: 1.5 },
        { questionId: 'q4', choice: Number.NaN },
      ]),
    ).toBe(0);
  });

  it('scores a partial submission from the answers it was given', () => {
    expect(scoreSubmission([{ questionId: 'q1', choice: answerFor('q1')!.correct }])).toBe(1);
    expect(scoreSubmission([])).toBe(0);
  });

  it('spreads the correct option across all four positions', () => {
    const positions = QUIZ_QUESTIONS.map((question) => answerFor(question.id)!.correct);
    const countAt = (position: number) => positions.filter((p) => p === position).length;
    for (const position of [0, 1, 2, 3]) {
      expect(countAt(position), `option ${position} is never the right answer`).toBeGreaterThan(0);
      // Four of ten is the ceiling. At five, "always press button N" would clear
      // the silver rung without knowing anything.
      expect(countAt(position), `option ${position} carries too many answers`).toBeLessThanOrEqual(4);
    }
  });

  it('does not let one button position win a tier worth having', () => {
    // The exploit this pins down: with every correct answer at index 0, pressing
    // the first button ten times scored 10/10 and minted a 40% code. The quiz
    // has to be a quiz.
    for (const position of [0, 1, 2, 3]) {
      const answers = QUIZ_QUESTIONS.map((question) => ({
        questionId: question.id,
        choice: position,
      }));
      const tier = tierForScore(scoreSubmission(answers));
      expect(tier.id, `always picking option ${position} earned ${tier.percent}% off`).toBe('bronze');
    }
  });
});

describe('the reward ladder', () => {
  it('is sorted hardest first, with bronze as the floor', () => {
    const thresholds = QUIZ_TIERS.map((tier) => tier.minCorrect);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => b - a));
    // The last rung must be 0, or a low score would find no tier at all.
    expect(QUIZ_TIERS[QUIZ_TIERS.length - 1].minCorrect).toBe(0);
  });

  it('pays the three promised percentages, and only those', () => {
    expect([...QUIZ_PERCENTAGES].sort((a, b) => a - b)).toEqual([10, 20, 40]);
  });

  it('picks the tier at each boundary', () => {
    // Both sides of both boundaries, because an off-by-one here pays out 40%
    // for a score that earned 20.
    expect(tierForScore(0).id).toBe('bronze');
    expect(tierForScore(4).id).toBe('bronze');
    expect(tierForScore(5).id).toBe('silver');
    expect(tierForScore(7).id).toBe('silver');
    expect(tierForScore(8).id).toBe('gold');
    expect(tierForScore(10).id).toBe('gold');
  });

  it('clamps a score outside the question count instead of failing', () => {
    expect(tierForScore(-3).id).toBe('bronze');
    expect(tierForScore(10_000).id).toBe('gold');
    expect(tierForScore(Number.NaN).id).toBe('bronze');
    expect(tierForScore(7.9).id).toBe('silver');
  });
});

describe('the campaign window', () => {
  it('closes at the instant the config names', () => {
    const ends = Date.parse(CAMPAIGN.endsAt);
    expect(Number.isFinite(ends)).toBe(true);
    expect(campaignIsOpen(ends)).toBe(true);
    expect(campaignIsOpen(ends + 1)).toBe(false);
    // Ends after the Delhi show it rides, or the offer would be over before the
    // concert it is named for.
    expect(ends).toBeGreaterThan(Date.parse(`${CAMPAIGN.concertDate}T00:00:00+05:30`));
  });

  it('reads the end date in IST, whatever the server clock says', () => {
    // 18:29:59Z is 23:59:59 IST on 30 November, not 30 November 18:29 and not
    // 1 December. A label computed in the server's own zone would say the
    // wrong day for anyone east or west of UTC.
    expect(campaignEndsLabel()).toContain('30 November 2026');
  });

  it('points the CTA at the show it rides', () => {
    expect(CAMPAIGN.concertUrl).toContain('delhi');
    expect(CAMPAIGN.concertDate).toBe('2026-10-30');
  });
});

describe('the code format', () => {
  it('generates a code its own validator accepts', () => {
    // The property that matters: mint and validate cannot drift apart. A code
    // the promo field rejects is a reward the shopper cannot spend.
    for (let i = 0; i < 200; i += 1) {
      const code = generateCode();
      expect(isValidCodeFormat(code), `generated an invalid code: ${code}`).toBe(true);
      expect(code).toHaveLength(CODE_PREFIX.length + CODE_LENGTH);
      expect(code.startsWith(CODE_PREFIX)).toBe(true);
    }
  });

  it('draws only from an alphabet with no lookalike characters', () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(32);
    // 256 is divisible by 32, which is what makes `byte & 31` unbiased. A
    // 26-letter alphabet would have needed rejection sampling.
    expect(256 % CODE_ALPHABET.length).toBe(0);
    for (const character of 'IO01') {
      expect(CODE_ALPHABET).not.toContain(character);
    }
  });

  it('normalises case and surrounding space, and nothing else', () => {
    expect(normalizeCode('  aura-abcdef  ')).toBe('AURA-ABCDEF');
    // A stray inner space is a different code, not a typo to repair silently.
    expect(normalizeCode('AURA ABCDEF')).toBe('AURA ABCDEF');
    expect(isValidCodeFormat('  aura-abcdef  ')).toBe(true);
    expect(isValidCodeFormat('AURA-ABCDEF')).toBe(true);
  });

  it('rejects the shapes a shopper actually mistypes', () => {
    expect(isValidCodeFormat('')).toBe(false);
    expect(isValidCodeFormat('AURA-')).toBe(false);
    expect(isValidCodeFormat('AURA-ABCDE')).toBe(false);
    expect(isValidCodeFormat('AURA-ABCDEFG')).toBe(false);
    expect(isValidCodeFormat('BURA-ABCDEF')).toBe(false);
    // The two ambiguous characters the alphabet exists to exclude.
    expect(isValidCodeFormat('AURA-ABCDE0')).toBe(false);
    expect(isValidCodeFormat('AURA-ABCDEI')).toBe(false);
    expect(isValidCodeFormat('AURA-ABCDEF-')).toBe(false);
    expect(isValidCodeFormat(' AURA-ABCDEF ')).toBe(true);
  });

  it('has a code space large enough that collisions are not the design', () => {
    expect(CODE_SPACE).toBe(32 ** 6);
    expect(CODE_SPACE).toBeGreaterThan(1_000_000_000);
  });

  it('does not repeat a code across a realistic campaign', () => {
    // Not a collision proof — a birthday-bound smoke test. 5,000 codes out of
    // 1.07e9 collides with probability ~1.2%; a duplicate here means the
    // generator lost its entropy, which is the failure worth catching.
    const codes = new Set<string>();
    for (let i = 0; i < 5_000; i += 1) codes.add(generateCode());
    expect(codes.size).toBe(5_000);
  });
});

describe('prompt rendering', () => {
  it('splits emphasis markers into runs instead of passing HTML through', () => {
    expect(promptParts('Which track from *Back 2 Basics* won?')).toEqual([
      { text: 'Which track from ', em: false },
      { text: 'Back 2 Basics', em: true },
      { text: ' won?', em: false },
    ]);
    expect(promptParts('no markers')).toEqual([{ text: 'no markers', em: false }]);
    expect(promptParts('')).toEqual([]);
  });

  it('renders every question prompt without leaking a marker', () => {
    for (const question of QUIZ_QUESTIONS) {
      const parts = promptParts(question.prompt);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.text).not.toContain('*');
        expect(part.text.length).toBeGreaterThan(0);
      }
      expect(parts.map((part) => part.text).join('')).not.toContain('*');
    }
  });
});

/**
 * Where the pop-up may appear. Pure function, so it is testable without a DOM —
 * which is the reason it lives in `gateRules.ts` rather than inside the hook.
 *
 * These rules fail silently and expensively: a modal over the payment form, or
 * a second copy of the quiz on top of the quiz page, costs a conversion rather
 * than throwing an error.
 */
describe('pop-up route rules', () => {
  it('allows the browsing surfaces', () => {
    expect(pathAllows('/')).toBe(true);
    expect(pathAllows('/concerts')).toBe(true);
    expect(pathAllows('/concerts/diljit-dosanjh-aura-delhi-2026')).toBe(true);
    expect(pathAllows('/artists')).toBe(true);
    // The artist *detail* page, which is the single most relevant page for a
    // quiz about one artist — and which this list used to miss entirely.
    expect(pathAllows('/artist/diljit-dosanjh')).toBe(true);
    expect(pathAllows('/collections')).toBe(true);
    expect(pathAllows('/collection/premium-store')).toBe(true);
  });

  it('never allows a buy page, a payment form, or the quiz page itself', () => {
    // The list that matters. `/product` is a conversion page, `/checkout` is
    // someone's typed address, and `/quiz` is a pop-up offering the quiz on top
    // of the quiz — the purest example of a modal that costs more than it earns.
    for (const path of [
      '/product/diljit-dosanjh-punjabi-aa-gaye-oye-oversized-t-shirt',
      '/cart',
      '/checkout',
      '/checkout/success',
      '/account',
      '/account/orders',
      '/auth/login',
      '/track-order',
      '/search',
      '/quiz',
    ]) {
      expect(pathAllows(path), `${path} must not carry a quiz pop-up`).toBe(false);
    }
  });

  it('treats "/" as an exact match, not a prefix of the whole site', () => {
    // As a prefix, '/' would allow every route and make the list meaningless.
    expect(pathAllows('/about')).toBe(false);
    expect(pathAllows('/blog/some-post')).toBe(false);
    expect(pathAllows('/faq')).toBe(false);
  });

  it('matches a section only at a path boundary', () => {
    // `/concertsomething` is not inside `/concerts`.
    expect(pathAllows('/concertsomething')).toBe(false);
    expect(pathAllows('/artistx')).toBe(false);
  });

  it('suppresses a nested path under a suppressed prefix', () => {
    expect(pathAllows('/product/anything/at/all')).toBe(false);
    expect(pathAllows('/account/orders/123')).toBe(false);
  });

  it('keeps every allowed prefix a real route on the site', () => {
    // Both spellings of both browse sections. A missing one silently disables
    // the pop-up on a page the campaign wanted, and looks exactly like a
    // campaign nobody triggers.
    expect([...ALLOWED_PREFIXES]).toEqual([
      '/',
      '/concerts',
      '/artists',
      '/artist',
      '/collections',
      '/collection',
    ]);
    // And the suppressed list must keep the ones the money path depends on.
    for (const required of ['/checkout', '/cart', '/product', '/quiz']) {
      expect(SUPPRESSED_PREFIXES as readonly string[]).toContain(required);
    }
  });
});

/**
 * Reading the mint reply. The runner's only branch with consequences, and the
 * one place a malformed response could put a wrong number in a shopper's cart —
 * so it is a pure function, and this is where it is pinned.
 */
describe('mint response', () => {
  const good = { code: 'AURA-7KQ2MZ', percent: 40, correct: 9, total: 10, tier: 'gold' };

  it('accepts a complete response', () => {
    expect(readMintResponse(good, 0)).toEqual({
      kind: 'code',
      result: { code: 'AURA-7KQ2MZ', percent: 40, correct: 9, total: 10, tier: 'gold' },
    });
  });

  it('reads a closed campaign as closed, not as a failure to retry', () => {
    // The real 410 body: an error and a reason, and no `code` field at all.
    // Checking for `code` first would call this a generic error and send the
    // player back to question ten to retry something that can never succeed.
    const body = { error: 'This quiz has closed. Look out for the next one.', reason: 'CAMPAIGN_CLOSED' };
    expect(readMintResponse(body, 4)).toEqual({ kind: 'closed' });
  });

  it('rejects a body that is not an object at all', () => {
    for (const input of [null, undefined, '', 'nope', 7, true, []]) {
      expect(readMintResponse(input, 3)).toEqual({
        kind: 'error',
        message: MINT_FAILURE_MESSAGE,
      });
    }
  });

  it('rejects a missing or blank code', () => {
    expect(readMintResponse({ percent: 20 }, 3).kind).toBe('error');
    expect(readMintResponse({ code: '', percent: 20 }, 3).kind).toBe('error');
    expect(readMintResponse({ code: '   ', percent: 20 }, 3).kind).toBe('error');
    expect(readMintResponse({ code: 42, percent: 20 }, 3).kind).toBe('error');
  });

  it('rejects a percent that is not a usable whole number', () => {
    // `typeof NaN === 'number'`, so a bare typeof check accepts NaN here — and
    // `JSON.stringify(NaN)` is `null`, so it survives a round trip. It would
    // reach the promo store, where `computeTotals` clamps it to 0 while the
    // discount line renders it literally: a cart showing a discount its own
    // total did not take.
    //
    // The coercible values are the second trap: `Number(null)`, `Number('')` and
    // `Number([])` are all `0`, and `Number('40')` is `40`. A guard written as
    // `Number.isInteger(Number(x))` accepts every one of them as a real percent.
    const coercible: unknown[] = [null, undefined, '', '40', '0', [], {}, true];
    const outOfRange: unknown[] = [NaN, Infinity, -Infinity, 12.5, -20, 91];
    for (const percent of [...coercible, ...outOfRange]) {
      expect(readMintResponse({ ...good, percent }, 3).kind, `percent=${JSON.stringify(percent)}`).toBe(
        'error'
      );
    }
  });

  it('keeps the server’s error copy when it sends one', () => {
    expect(readMintResponse({ error: 'Rate limited. Try later.' }, 3)).toEqual({
      kind: 'error',
      message: 'Rate limited. Try later.',
    });
  });

  it('accepts a 0% code rather than locking the player out of a real row', () => {
    // The CHECK constraint only allows 10/20/40, so a 0 means something upstream
    // is wrong. Shape is validated here and business rules are not: refusing a
    // code the database actually issued would strand a player who did nothing
    // wrong. `quiz_completed` already files an unlabelable percent as 0.
    const outcome = readMintResponse({ ...good, percent: 0, tier: 'bronze' }, 2);
    expect(outcome.kind).toBe('code');
  });

  it('falls back to the client tally only for the labels', () => {
    const outcome = readMintResponse({ code: 'AURA-7KQ2MZ', percent: 20 }, 6);
    expect(outcome).toEqual({
      kind: 'code',
      // 6 correct is silver, derived — the server sent no tier and no total.
      result: { code: 'AURA-7KQ2MZ', percent: 20, correct: 6, total: QUIZ_QUESTION_COUNT, tier: 'silver' },
    });
  });

  it('derives an unrecognised tier from the score instead of defaulting to bronze', () => {
    // `tier ?? 'bronze'` would have labelled this gold winner's result screen
    // "Bronze" — a wrong label on the one screen whose job is to say what they won.
    for (const tier of ['platinum', '', null, 7]) {
      const outcome = readMintResponse({ ...good, tier }, 9);
      expect(outcome.kind).toBe('code');
      if (outcome.kind === 'code') expect(outcome.result.tier).toBe('gold');
    }
  });

  it('never lets a body without a usable code through as a result', () => {
    // The rule the module exists for, stated once as a sweep: no field
    // combination that lacks a real code may produce `kind: 'code'`.
    const bodies: unknown[] = [
      {},
      { code: null, percent: 40 },
      { code: 'AURA-7KQ2MZ' },
      { percent: 40 },
      { code: 'AURA-7KQ2MZ', percent: null },
      { code: 'AURA-7KQ2MZ', percent: '40' },
      { code: 'AURA-7KQ2MZ', percent: {} },
    ];
    for (const body of bodies) {
      expect(readMintResponse(body, 5).kind, JSON.stringify(body)).not.toBe('code');
    }
  });
});


