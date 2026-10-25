'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isValidCodeFormat, normalizeCode } from '@/features/quiz/codes';

/**
 * The promo code the shopper has applied, if any.
 *
 * One store rather than props through the cart drawer and the checkout page:
 * the code is typed in the cart, has to reach `useRazorpay`'s request bodies,
 * and has to render a discount line in the summary — three places that are not
 * in a parent/child chain.
 *
 * Persisted, because a shopper who earns a code in the quiz pop-up and buys two
 * days later should not have to retype it. Only the code and the percent it was
 * checked at are stored, both client-owned; nothing here is trusted as an
 * amount. `create-order` re-resolves the code against the database and answers
 * `CODE_INVALID` if it has definitively gone (this store clears itself on that
 * token) or `CODE_UNAVAILABLE` when the lookup was merely transient (kept).
 *
 * `percent` is what the *last check* returned, so the cart can show "−20%"
 * without a request on every render. It is a display value: the server prices
 * the cart from its own lookup, never from this.
 */

export type PromoStatus = 'idle' | 'checking' | 'applied' | 'invalid';

/**
 * What one `apply` call decided. `transient` marks a failure that is *not* the
 * code's fault — network drop, or an answer superseded by a newer apply — so
 * the caller can skip recording a rejection the funnel would misread.
 */
export type ApplyOutcome = { applied: true } | { applied: false; transient: boolean };

/**
 * Monotonic token for in-flight checks. Every apply/revalidate captures the
 * current value and drops its own result if the value moved — the only moves
 * are a newer apply, an `applyKnown` (the quiz just minted a code) or a
 * `clear`, and in each of those a late response from the *older* check must
 * not overwrite what the shopper now has. Module-scope on purpose: it is not
 * state anyone renders.
 */
let applySeq = 0;

interface PromoState {
  code: string | null;
  percent: number;
  status: PromoStatus;
  /** Rejection copy from the last check; null when there is nothing to say. */
  message: string | null;
  _hasHydrated: boolean;
}

interface PromoActions {
  /** Check `code` against the server and apply it when it is usable. */
  apply: (code: string) => Promise<ApplyOutcome>;
  /** Apply a code the server has already accepted, without a second check. */
  applyKnown: (code: string, percent: number) => void;
  /**
   * Re-check the code already in the store (used when a persisted code
   * rehydrates and when the campaign window closes): drop it on a definitive
   * rejection, keep it through anything transient.
   */
  revalidate: () => Promise<void>;
  /** Drop the code (the shopper removed it, or the server rejected it). */
  clear: (message?: string | null) => void;
  setHasHydrated: (state: boolean) => void;
}

type PromoStore = PromoState & PromoActions;

interface CodeCheckResponse {
  ok?: boolean;
  percent?: number;
  reason?: string;
  message?: string;
}

/** Reasons that mean "not this code's fault" — the code stays in the store. */
const TRANSIENT_REASONS = new Set(['held', 'unavailable']);

async function checkCode(code: string): Promise<CodeCheckResponse | null> {
  try {
    const response = await fetch('/api/quiz/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return (await response.json().catch(() => ({}))) as CodeCheckResponse;
  } catch {
    return null;
  }
}

export const usePromoStore = create<PromoStore>()(
  persist(
    (set, get) => ({
      code: null,
      percent: 0,
      status: 'idle',
      message: null,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      apply: async (raw) => {
        const code = normalizeCode(raw);
        // Shape check first: a malformed code is a typo, and saying so without a
        // request keeps the rate limit for codes that could actually exist.
        if (!isValidCodeFormat(code)) {
          set({ status: 'invalid', message: 'That code is not valid. Check the spelling and try again.' });
          return { applied: false, transient: false };
        }

        const seq = ++applySeq;
        set({ status: 'checking', message: null });

        const data = await checkCode(code);
        if (seq !== applySeq) {
          // A newer apply, a freshly minted code or a clear won while this was
          // in flight. Say nothing: whatever it decided is already stale.
          return { applied: false, transient: true };
        }

        if (data === null) {
          // A network failure is not a rejection: keep any code already applied
          // and say what happened, rather than telling the shopper their code is
          // invalid because their train went into a tunnel.
          set({ status: get().code ? 'applied' : 'invalid', message: 'Could not check that code. Please try again.' });
          return { applied: false, transient: true };
        }

        if (data.ok === true && Number.isInteger(data.percent)) {
          set({ code, percent: data.percent as number, status: 'applied', message: null });
          return { applied: true, transient: false };
        }

        set({
          status: 'invalid',
          message: data.message ?? 'That code could not be applied.',
        });
        return { applied: false, transient: false };
      },

      applyKnown: (raw, percent) => {
        const code = normalizeCode(raw);
        if (!isValidCodeFormat(code) || !Number.isInteger(percent)) return;
        applySeq += 1;
        set({ code, percent, status: 'applied', message: null });
      },

      revalidate: async () => {
        const code = get().code;
        if (!code) return;
        const seq = ++applySeq;
        const data = await checkCode(code);
        if (seq !== applySeq || data === null) return;

        if (data.ok === true && Number.isInteger(data.percent)) {
          // Still good. Confirming (rather than only failing) matters: a
          // rehydrated code restores with status 'idle', and this is what
          // makes it 'applied' for the field that renders from status.
          set({ percent: data.percent as number, status: 'applied', message: null });
          return;
        }
        if (data.ok !== false || TRANSIENT_REASONS.has(String(data.reason))) {
          // Unreadable answer, or held/unavailable: not the code's fault.
          return;
        }
        // Definitive (not found / redeemed / expired): drop it with the
        // server's own copy so the field explains why it vanished.
        set({ code: null, percent: 0, status: 'idle', message: data.message ?? null });
      },

      clear: (message = null) => {
        applySeq += 1;
        set({ code: null, percent: 0, status: 'idle', message });
      },
    }),
    {
      name: 'yord-promo',
      version: 1,
      partialize: (state) => ({ code: state.code, percent: state.percent }),
      onRehydrateStorage: () => (state, error) => {
        // Unusable storage (private mode, disabled cookies) must not leave the
        // store "unhydrated" forever: the promo field gates on that flag and
        // would never render at all. Treat it as an empty store and carry on.
        if (error) {
          usePromoStore.getState().setHasHydrated(true);
          return;
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

/** True once the persisted promo code has loaded. Gate the discount line on it. */
export function usePromoHydrated(): boolean {
  return usePromoStore((state) => state._hasHydrated);
}

/** The percent to price the cart at: 0 until a code has been checked. */
export function usePromoPercent(): number {
  return usePromoStore((state) => (state.code ? state.percent : 0));
}
