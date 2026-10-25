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
 * `CODE_INVALID` if it has gone, at which point this store clears itself.
 *
 * `percent` is what the *last check* returned, so the cart can show "−20%"
 * without a request on every render. It is a display value: the server prices
 * the cart from its own lookup, never from this.
 */

export type PromoStatus = 'idle' | 'checking' | 'applied' | 'invalid';

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
  apply: (code: string) => Promise<boolean>;
  /** Apply a code the server has already accepted, without a second check. */
  applyKnown: (code: string, percent: number) => void;
  /** Drop the code (the shopper removed it, or the server rejected it). */
  clear: (message?: string | null) => void;
  setHasHydrated: (state: boolean) => void;
}

type PromoStore = PromoState & PromoActions;

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
          return false;
        }

        set({ status: 'checking', message: null });

        try {
          const response = await fetch('/api/quiz/code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const data = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            percent?: number;
            message?: string;
          };

          if (data.ok && typeof data.percent === 'number') {
            set({ code, percent: data.percent, status: 'applied', message: null });
            return true;
          }

          set({
            status: 'invalid',
            message: data.message ?? 'That code could not be applied.',
          });
          return false;
        } catch {
          // A network failure is not a rejection: keep any code already applied
          // and say what happened, rather than telling the shopper their code is
          // invalid because their train went into a tunnel.
          set({ status: get().code ? 'applied' : 'invalid', message: 'Could not check that code. Please try again.' });
          return false;
        }
      },

      applyKnown: (raw, percent) => {
        const code = normalizeCode(raw);
        if (!isValidCodeFormat(code) || !Number.isFinite(percent)) return;
        set({ code, percent, status: 'applied', message: null });
      },

      clear: (message = null) => set({ code: null, percent: 0, status: 'idle', message }),
    }),
    {
      name: 'yord-promo',
      version: 1,
      partialize: (state) => ({ code: state.code, percent: state.percent }),
      onRehydrateStorage: () => (state) => {
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
