'use client';

import dynamic from 'next/dynamic';
import { useQuizGate } from './useQuizGate';

/**
 * Mount point for the quiz pop-up. One line in `ClientProviders`, and everything
 * else — when to show, what to show, what to do with the answer — lives behind
 * this boundary.
 *
 * The pop-up itself is a `next/dynamic` import, and the first mount is gated on
 * the gate's `hasFired` latch: `next/dynamic` starts loading its chunk as soon
 * as the wrapped component renders, so mounting `QuizPopup` on every page with
 * `open={false}` would still download and parse the quiz bundle (and its ten
 * questions) for every visitor, on every browsing page, for a campaign most
 * never open. The latch turns once, inside the gate's trigger callback, and
 * stays on — `Overlay` needs its 300 ms exit transition after a dismissal, and
 * unmounting on `shouldShow` false would cut that off.
 *
 * `ssr: false` because every trigger condition reads browser state (path,
 * scroll, sessionStorage, localStorage) — rendering it on the server would
 * either flash a modal or render nothing and hydrate into one.
 */
const QuizPopup = dynamic(() => import('./QuizPopup').then((mod) => mod.QuizPopup), {
  ssr: false,
});

export function QuizPromo() {
  const { shouldShow, hasFired, dismiss, trigger } = useQuizGate();

  if (!hasFired) return null;
  return <QuizPopup open={shouldShow} onClose={dismiss} trigger={trigger} />;
}
