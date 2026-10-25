'use client';

import dynamic from 'next/dynamic';
import { useQuizGate } from './useQuizGate';

/**
 * Mount point for the quiz pop-up. One line in `ClientProviders`, and everything
 * else — when to show, what to show, what to do with the answer — lives behind
 * this boundary.
 *
 * The pop-up itself is a `next/dynamic` import so its chunk (and the quiz
 * questions) is fetched only once a visitor actually triggers it. Ten questions
 * of copy on the critical path of a product page would be a real cost for a
 * campaign most visitors never open.
 *
 * `ssr: false` because every trigger condition reads browser state (path,
 * scroll, sessionStorage, localStorage) — rendering it on the server would
 * either flash a modal or render nothing and hydrate into one.
 */
const QuizPopup = dynamic(() => import('./QuizPopup').then((mod) => mod.QuizPopup), {
  ssr: false,
});

export function QuizPromo() {
  const { shouldShow, dismiss, trigger } = useQuizGate();
  return <QuizPopup open={shouldShow} onClose={dismiss} trigger={trigger} />;
}
