/**
 * The quiz questions, safe to ship to the browser: prompts and options only.
 * The correct option for each id lives in `answers.ts`, which starts with
 * `import 'server-only'` — so the key cannot be read out of the bundle.
 *
 * That split is the whole reason `POST /api/quiz/answer` exists. Instant
 * right/wrong feedback needs the key on the client, and a key in the client is
 * a 40%-off code for anyone who opens devtools and greps. Scoring one answer at
 * a time on the server keeps the feedback and drops the leak.
 *
 * Facts are drawn from Diljit Dosanjh's Wikipedia article and its cited
 * sources. `quiz.test.ts` asserts the answer key covers every id here with an
 * in-range index, so a question added without an answer fails the suite rather
 * than shipping an unanswerable card.
 */

/** 1 = easy, 2 = medium, 3 = hard. Drives the label and the ordering. */
export type QuizLevel = 1 | 2 | 3;

export interface QuizQuestion {
  id: string;
  level: QuizLevel;
  prompt: string;
  /** Exactly `QUIZ_OPTION_COUNT` entries, in display order. */
  options: readonly string[];
}

/** Four options each, so the card's button stack never changes height. */
export const QUIZ_OPTION_COUNT = 4;

/**
 * Ten questions, easy to hard. The order is the ramp: the first three are
 * answerable by anyone who has heard of him, the last three need the deep cuts.
 *
 * **The correct option is never in the same position twice in a row, and no
 * position carries more than four of the ten.** That is not cosmetic: if every
 * answer were the first option, "press the first button ten times" would win the
 * 40% code and the quiz would be a discount button with extra steps. The
 * positions are asserted in `quiz.test.ts` and must be kept spread when a
 * question is edited or added.
 */
export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'q1',
    level: 1,
    prompt: 'Diljit Dosanjh sings mainly in which language?',
    options: ['Hindi', 'Punjabi', 'Bengali', 'Tamil'],
  },
  {
    id: 'q2',
    level: 1,
    prompt: 'Which 2024 film did he star in as the singer Amar Singh Chamkila?',
    options: ['Udta Punjab', 'Phillauri', 'Amar Singh Chamkila', 'Jatt & Juliet 3'],
  },
  {
    id: 'q3',
    level: 1,
    prompt: 'What does his 2020 album title G.O.A.T. stand for?',
    options: ['Greatest of All Time', 'God of All Things', 'Greatness of a Turbanator', 'Gold on All Tracks'],
  },
  {
    id: 'q4',
    level: 2,
    prompt: 'In 2023 he became the first Punjabi artist to perform at which festival?',
    options: ['Glastonbury', 'Lollapalooza', 'Tomorrowland', 'Coachella'],
  },
  {
    id: 'q5',
    level: 2,
    prompt: 'Which 2012 film with Neeru Bajwa made him a star?',
    options: ['Jihne Mera Dil Luteya', 'Jatt & Juliet', 'Disco Singh', 'Sajjan Singh Rangroot'],
  },
  {
    id: 'q6',
    level: 2,
    prompt: 'Which 2016 film was his Bollywood debut, winning him the Filmfare Best Male Debut?',
    options: ['Phillauri', 'Good Newwz', 'Soorma', 'Udta Punjab'],
  },
  {
    id: 'q7',
    level: 2,
    prompt: 'In 2019 he became the first turbaned Sikh honoured with a wax figure. Where?',
    options: [
      'Madame Tussauds',
      'The Grammy Museum',
      "Ripley's Believe It or Not!",
      'The Rock and Roll Hall of Fame',
    ],
  },
  {
    id: 'q8',
    level: 3,
    prompt: 'What was the title of his debut album?',
    options: ['Smile', 'Chocolate', 'Ishq Da Uda Ada', 'The Next Level'],
  },
  {
    id: 'q9',
    level: 3,
    prompt:
      'Which 2014 film of his won the National Film Award for Best Feature Film in Punjabi?',
    options: ['Punjab 95', 'Punjab 1984', 'Sajjan Singh Rangroot', 'The Lion of Punjab'],
  },
  {
    id: 'q10',
    level: 3,
    prompt:
      'Which track from *Back 2 Basics* won Best Bhangra Song of the Year at both the Brit Asia TV and PTC Punjabi awards?',
    options: ['Proper Patola', 'Lak 28 Kudi Da', 'Kharku', 'Dil Nach Da'],
  },
] as const;

export const QUIZ_QUESTION_COUNT = QUIZ_QUESTIONS.length;

/** Difficulty chip copy for the question card. */
export const LEVEL_LABEL: Record<QuizLevel, string> = {
  1: 'Warm-up',
  2: 'Real fan',
  3: 'Deep cut',
};

/**
 * A prompt is rendered as plain text with `*emphasis*` markers, so this splits
 * it into runs rather than the UI reaching for `dangerouslySetInnerHTML` on
 * editorial copy. Kept beside the data it formats.
 */
export function promptParts(prompt: string): { text: string; em: boolean }[] {
  return prompt
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('*') && part.endsWith('*')
        ? { text: part.slice(1, -1), em: true }
        : { text: part, em: false }
    );
}
