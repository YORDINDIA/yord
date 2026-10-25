'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuizTierId } from './config';

/**
 * What the quiz pop-up needs to remember about a visitor.
 *
 * Two lifetimes, and mixing them is the bug this shape avoids:
 *
 * - **Persisted** (`completed`, `result`, `dismissals`, `lastDismissedAt`):
 *   a finished quiz must never be asked again, a code must survive a reload,
 *   and a visitor who has said no twice should stop being asked for a while.
 *   This is the whole of the store — it is `persist`ed to localStorage.
 * - **Session**: "not again for the rest of this visit". Deliberately *not*
 *   here, because it cannot live in localStorage or one dismissal would silence
 *   the pop-up forever. `useQuizGate` writes it to sessionStorage under
 *   `yord-quiz-shown` — one tab, one visit, gone when the tab closes. There is
 *   no `shownThisSession` field to look for.
 *
 * `result` is stored so the result screen survives a refresh. It is not a
 * source of truth: the code's percent is re-resolved by the server on every
 * checkout, and the code itself is re-returned by `/api/quiz/complete` for a
 * repeat play.
 */

export interface QuizResult {
  code: string;
  percent: number;
  correct: number;
  total: number;
  tier: QuizTierId;
}

interface QuizState {
  /** Finished the quiz at least once. */
  completed: boolean;
  /** The last earned result, for the result screen after a reload. */
  result: QuizResult | null;
  /** How many times the visitor has closed the pop-up without playing. */
  dismissals: number;
  /** Epoch ms of the last dismissal; null when never dismissed. */
  lastDismissedAt: number | null;
  _hasHydrated: boolean;
}

interface QuizActions {
  setResult: (result: QuizResult) => void;
  markDismissed: () => void;
  setHasHydrated: (state: boolean) => void;
}

type QuizStore = QuizState & QuizActions;

export const useQuizStore = create<QuizStore>()(
  persist(
    (set) => ({
      completed: false,
      result: null,
      dismissals: 0,
      lastDismissedAt: null,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setResult: (result) =>
        set({
          completed: true,
          result,
          // Playing clears the no-thanks record: someone who dismissed twice and
          // then came back and finished should not still be in a cooldown.
          dismissals: 0,
          lastDismissedAt: null,
        }),

      markDismissed: () =>
        set((state) => ({
          dismissals: state.dismissals + 1,
          lastDismissedAt: Date.now(),
        })),
    }),
    {
      name: 'yord-quiz',
      version: 1,
      partialize: (state) => ({
        completed: state.completed,
        result: state.result,
        dismissals: state.dismissals,
        lastDismissedAt: state.lastDismissedAt,
      }),
      onRehydrateStorage: () => (state, error) => {
        // Unusable storage (private mode, locked-down browser) must not leave
        // the store "unhydrated" forever — `useQuizGate` blocks on that flag,
        // so the campaign would never appear at all. Treat it as a fresh
        // visitor: no stored result, no dismissal history.
        if (error) {
          useQuizStore.getState().setHasHydrated(true);
          return;
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

export function useQuizHydrated(): boolean {
  return useQuizStore((state) => state._hasHydrated);
}
