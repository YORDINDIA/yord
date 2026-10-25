'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Tag, X } from 'lucide-react';
import { cn } from '@yord/ui';
import { usePromoHydrated, usePromoStore } from '@/lib/stores/promoStore';
import { useCartStore } from '@/lib/stores/cartStore';
import { track } from '@/lib/analytics/track';
import { campaignEndsLabel } from '@/features/quiz/config';
import { useCampaignOpen } from '@/features/quiz/useCountdown';
import { useEligibleProductIds } from '@/features/quiz/useEligibleProductIds';

/**
 * The promo field. Lives in the cart drawer and on the checkout rail — the two
 * places a shopper looks at a total — and both read the same store, so applying
 * a code in one shows the discount in the other.
 *
 * Three states matter to the layout, and each renders something different:
 * nothing applied (an input), checking (a pending row), and applied (the code
 * and what it is worth, with a way to remove it). The error message sits under
 * the input rather than in a toast: it belongs to the field that caused it, and
 * a shopper who mistyped a character is looking right there.
 *
 * The percent shown comes from the server's answer, never from the code's
 * shape. A code that has expired or been used renders as rejected here, before
 * the shopper reaches the payment step where it would cost a refund to find out.
 */
export function PromoCode({
  className,
  surface,
  onNavigate,
}: {
  className?: string;
  surface: 'cart' | 'checkout';
  /** Called before following the "no code yet?" link, so a drawer can close. */
  onNavigate?: () => void;
}) {
  const hydrated = usePromoHydrated();
  const campaignOpen = useCampaignOpen();
  const code = usePromoStore((state) => state.code);
  const percent = usePromoStore((state) => state.percent);
  const status = usePromoStore((state) => state.status);
  const message = usePromoStore((state) => state.message);
  const apply = usePromoStore((state) => state.apply);
  const revalidate = usePromoStore((state) => state.revalidate);
  const clear = usePromoStore((state) => state.clear);
  const items = useCartStore((state) => state.items);
  // Only read once a code is on show, and only warn on a *known* empty scope —
  // while it loads the honest line is nothing, not a false "nothing eligible".
  const eligibleIds = useEligibleProductIds();
  const noEligibleItems =
    code !== null &&
    items.length > 0 &&
    eligibleIds !== null &&
    !items.some((item) => eligibleIds.has(item.productId));

  const [draft, setDraft] = useState('');
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const checking = status === 'checking';

  // A persisted code is a claim from an earlier session, and the world may have
  // moved since: the code could have been spent on another device or the window
  // may have closed. Re-check it once per hydration and again when the campaign
  // closes under a still-open tab, so the shopper sees the truth in this field
  // rather than at the payment step, where finding out costs a refund. The
  // server's answer is the only thing that clears it — a local clock running
  // fast must not delete a code the server still honours.
  useEffect(() => {
    if (!hydrated || !code) return;
    void revalidate();
  }, [hydrated, code, campaignOpen, revalidate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (checking || draft.trim().length === 0) return;
    const outcome = await apply(draft);
    if (outcome.applied) {
      // Read the store rather than the response: `apply` normalises the code and
      // is the only place that knows the percent the server returned. A percent
      // outside the three campaign tiers is not an event worth recording, so it
      // is dropped rather than coerced into one of them.
      const applied = usePromoStore.getState().percent;
      if (applied === 10 || applied === 20 || applied === 40) {
        track({ type: 'promo_applied', percent: applied, surface });
      }
      setDraft('');
    } else if (!outcome.transient) {
      // Only a definitive server rejection is a funnel event: `transient` marks
      // a network drop or a check superseded by a newer one, and counting those
      // as rejections would blame working codes for train tunnels.
      // The reason is server copy. It is bounded and contains no user input, so
      // it is safe to store and is what makes the rejection reasons sortable.
      const reason = usePromoStore.getState().message ?? 'unknown';
      track({ type: 'promo_rejected', reason: reason.slice(0, 128), surface });
    }
  };

  // Before rehydration the store looks empty, and rendering the input first
  // would flash it over a code the shopper already has. One frame of nothing is
  // cheaper than a wrong state.
  if (!hydrated) return null;

  if (code) {
    return (
      <div className={cn('border border-accent bg-accent-tint px-4 py-3', className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-accent text-xs tracking-[0.15em] text-accent">
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {percent}% OFF APPLIED
            </p>
            <p className="mt-0.5 truncate font-mono text-sm text-text-primary">{code}</p>
          </div>
          <button
            type="button"
            onClick={() => clear()}
            aria-label={`Remove code ${code}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          {noEligibleItems ? (
            <span className="text-danger">
              Your bag has no Diljit Dosanjh styles — this code will not change this order.
            </span>
          ) : (
            <>Diljit Dosanjh styles only · use it by {campaignEndsLabel()}.</>
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      <label
        htmlFor={inputId}
        className="flex items-center gap-1.5 text-xs text-text-muted"
      >
        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
        Have a code?
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // The format is AURA-XXXXXX. The field displays upper-case (the
          // `uppercase` class) and the store normalises on submit, so a shopper
          // typing lower-case is not punished for it — the alphabet has no
          // case-sensitive members.
          placeholder="AURA-XXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          aria-invalid={status === 'invalid'}
          aria-describedby={message ? errorId : undefined}
          className={cn(
            'min-h-[44px] flex-1 border bg-surface-input px-3 font-mono text-sm uppercase tracking-[0.1em] text-text-primary',
            'placeholder:normal-case placeholder:tracking-normal placeholder:text-text-subtle',
            // `--danger` rather than the stronger neutral border: a rejected
            // code has to look rejected, and `--border-strong` is the *input*
            // edge in both themes — it would read as "this field is normal".
            status === 'invalid' ? 'border-danger' : 'border-border-default'
          )}
        />
        <button
          type="submit"
          disabled={checking || draft.trim().length === 0}
          className="flex min-h-[44px] items-center justify-center border border-text-primary px-4 font-accent text-xs tracking-[0.15em] text-text-primary transition-colors hover:bg-text-primary hover:text-text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            'APPLY'
          )}
        </button>
      </div>
      {/* Live region so a rejected code is announced, not just coloured. */}
      <p
        id={errorId}
        role="status"
        className={cn('mt-1.5 min-h-[1rem] text-xs', status === 'invalid' ? 'text-danger' : 'text-text-muted')}
      >
        {message ?? ''}
      </p>

      {/*
        The quiz's front door, in the one place it is genuinely wanted: a
        shopper looking at a cart total, with a field for a code they do not
        have. Only in the cart, never on the checkout rail — offering a detour
        to a ten-question quiz to someone who has already typed their address is
        how a checkout gets abandoned.
      */}
      {surface === 'cart' && campaignOpen ? (
        <p className="mt-2 text-xs text-text-muted">
          No code yet?{' '}
          <Link
            href="/quiz"
            onClick={() => onNavigate?.()}
            className="underline decoration-border-strong underline-offset-2 transition-colors hover:text-text-secondary"
          >
            Take the Diljit quiz
          </Link>{' '}
          and win up to 40% off Diljit styles.
        </p>
      ) : null}
    </form>
  );
}
