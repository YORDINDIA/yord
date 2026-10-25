'use client';

import { useCallback, useRef } from 'react';
import { Overlay } from '@/features/ui/Overlay';
import { track } from '@/lib/analytics/track';
import { QuizRunner, type QuizPhase } from './QuizRunner';
import type { QuizTrigger } from './gateRules';

/**
 * The pop-up: the shared quiz machine inside the shared `Overlay`, which brings
 * the portal, backdrop, focus trap, Escape handling and scroll lock every other
 * dialog on the site already uses. None of that is re-implemented here.
 *
 * The trigger is `timer` or `scroll` — what `useQuizGate` saw first. `/quiz`
 * renders the same `QuizRunner` with `direct`, so one funnel reads continuously
 * whichever way a visitor arrived.
 *
 * **This component owns the dismissal, not the runner.** There are three ways
 * out — the panel's close button, Escape, and a backdrop click — and only the
 * first passes through the runner. The other two are `Overlay`'s, which calls
 * this component's `onClose` directly and never tells the runner. Tracking in
 * the runner therefore missed exactly the two paths a keyboard user takes, and
 * the funnel undercounted dismissals by however many people press Escape.
 * One handler here covers all three, so the count is complete.
 */
export function QuizPopup({
  open,
  onClose,
  trigger,
}: {
  open: boolean;
  onClose: () => void;
  trigger: QuizTrigger;
}) {
  // The screen the runner last reported. Closing before a code is earned is a
  // rejection; closing the result screen is the shopper leaving with their code,
  // which is a win and must not be counted as a dismissal.
  const phaseRef = useRef<QuizPhase>('intro');

  const handlePhase = useCallback((next: QuizPhase) => {
    phaseRef.current = next;
  }, []);

  const handleClose = useCallback(() => {
    const phase = phaseRef.current;
    // `submitting` counts as a dismissal: the close button, Escape and the
    // backdrop all stay live while the mint is in flight, and a close during
    // that wait is a real drop-off the funnel must not lose — especially on a
    // slow mint, which is exactly when a visitor gives up. Only the result
    // screen is exempt: closing there is leaving with the code, a win.
    if (phase === 'intro' || phase === 'quiz' || phase === 'submitting') {
      track({ type: 'quiz_dismissed', phase });
    }
    onClose();
  }, [onClose]);

  return (
    <Overlay open={open} onClose={handleClose} width="lg" labelledBy="quiz-title" className="max-w-xl">
      <QuizRunner
        variant="popup"
        trigger={trigger}
        onClose={handleClose}
        onPhaseChange={handlePhase}
      />
    </Overlay>
  );
}
