'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCartOpen } from '@/lib/stores/cartStore';
import { pathAllows, type QuizTrigger } from './gateRules';
import { useCampaignOpen } from './useCountdown';
import { useQuizHydrated, useQuizStore } from './quizStore';

/**
 * When the quiz pop-up is allowed to appear. All of it in one hook so the rules
 * are testable and the pop-up component only renders.
 *
 * The rules, and why each exists:
 *
 * - **Where.** `pathAllows` in `gateRules.ts` holds the route list (browsing
 *   surfaces only, never a buy page, a payment form or the quiz's own page).
 * - **When.** After a 12-second dwell or a 40%-scroll, whichever comes first,
 *   and only once the browser is idle — a pop-up that competes with the hero
 *   image for the main thread shows up late and janky on a phone.
 * - **While the campaign is open.** `useCampaignOpen` gates the whole thing.
 *   Without it the pop-up would still offer ten questions after 30 November,
 *   and the player would spend a minute on them only to be told by
 *   `/api/quiz/complete` that the quiz had closed.
 * - **How often.** Never after finishing the quiz. Once per tab session after a
 *   dismissal, and after two dismissals not for 14 days. Somebody who has said
 *   no twice is not a lead, they are a person being annoyed.
 * - **Not over another dialog.** The cart drawer, quick view and search modal
 *   all render `role="dialog"` through the shared `Overlay`. If one is open at
 *   trigger time the pop-up waits rather than stacking.
 */

const DELAY_MS = 12_000;
const SCROLL_TRIGGER = 0.4;
/** After this many dismissals, stop asking for a while. */
const DISMISSAL_LIMIT = 2;
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
/** sessionStorage marker: shown or dismissed at least once in this tab. */
const SESSION_KEY = 'yord-quiz-shown';

/** Read/write the session marker without throwing in a locked-down browser. */
function sessionShown(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    // Private mode with storage disabled: treat it as "already shown", so the
    // pop-up does not appear on every single navigation.
    return true;
  }
}

function markSessionShown(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Nothing to do — the fallback above already keeps this tab quiet.
  }
}

export interface QuizGate {
  /** Render the pop-up. False once it has been dismissed or finished. */
  shouldShow: boolean;
  /** The visitor closed it without playing. */
  dismiss: () => void;
  /** What surfaced it; 'timer' until a scroll fires first. */
  trigger: QuizTrigger;
}

export function useQuizGate(): QuizGate {
  const pathname = usePathname();
  const hydrated = useQuizHydrated();
  const campaignOpen = useCampaignOpen();
  const completed = useQuizStore((state) => state.completed);
  const dismissals = useQuizStore((state) => state.dismissals);
  const lastDismissedAt = useQuizStore((state) => state.lastDismissedAt);
  const markDismissed = useQuizStore((state) => state.markDismissed);
  const cartOpen = useCartOpen();

  const [armed, setArmed] = useState(false);
  const [trigger, setTrigger] = useState<QuizTrigger>('timer');
  const [dismissedNow, setDismissedNow] = useState(false);
  // The scroll listener and the timer both call this; the ref keeps a late
  // second call from re-arming a pop-up the visitor already closed.
  const firedRef = useRef(false);

  /**
   * Everything here is a pure function of props and store state, so it can be
   * computed during render. The cooldown is the exception — it needs the clock,
   * and `Date.now()` during render is not idempotent — so that check lives in
   * the effect below. `armed` is only ever set by that effect, which means the
   * effect is the single place the cooldown can let the pop-up through.
   */
  const cooling = dismissals >= DISMISSAL_LIMIT && lastDismissedAt !== null;

  const blocked =
    !hydrated ||
    !campaignOpen ||
    completed ||
    cartOpen ||
    dismissedNow ||
    !pathAllows(pathname ?? '/');

  useEffect(() => {
    if (blocked) return;
    if (cooling && Date.now() - (lastDismissedAt ?? 0) <= COOLDOWN_MS) return;
    if (sessionShown()) return;

    firedRef.current = false;

    const fire = (source: 'timer' | 'scroll') => {
      if (firedRef.current) return;
      // Never stack on another dialog. `Overlay` marks every panel it portals
      // with role="dialog", so this catches the cart, quick view and search.
      if (document.querySelector('[role="dialog"]')) return;
      firedRef.current = true;
      markSessionShown();
      setTrigger(source);
      setArmed(true);
    };

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      if (window.scrollY / scrollable >= SCROLL_TRIGGER) fire('scroll');
    };

    const start = () => {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    };

    // Wait for idle so the pop-up never competes with the first paint or a
    // hero image for the main thread.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 3_000 })
      : window.setTimeout(start, 0);
    const timer = window.setTimeout(() => fire('timer'), DELAY_MS);

    return () => {
      if (window.cancelIdleCallback && typeof idle === 'number') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [blocked, cooling, lastDismissedAt]);

  const dismiss = useCallback(() => {
    markDismissed();
    setDismissedNow(true);
    setArmed(false);
  }, [markDismissed]);

  return { shouldShow: armed && !blocked, dismiss, trigger };
}
