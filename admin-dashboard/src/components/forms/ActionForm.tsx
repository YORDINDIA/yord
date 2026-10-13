'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import type { ActionState } from '@/lib/action-state';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Shared form plumbing for every admin mutation.
 *
 * Every form runs through this so the three feedback channels are impossible to
 * forget:
 *
 *  - a form-level banner for a failed write (`formError`)
 *  - inline messages per field, from the shared zod schema's `fieldErrors`
 *  - a toast for success, so an admin who scrolled away still gets confirmation
 *
 * `pending` disables the submit button and swaps its label, which is what
 * replaces the old "clicked Save and nothing appeared to happen" experience.
 *
 * This module exports a hook, a field wrapper and a banner — plus `FormSection`
 * and `FormActions`, which are layout only. Still not a `<form>` component: each
 * admin form needs its own field layout, and a generic shell would have to grow
 * props for every variation (which is how the unused `hiddenFields`, `footer`,
 * and `submitVariant` props in the first draft ended up dead).
 */

/**
 * Run a server action and expose its state to a form.
 *
 * Use this when the form renders its own fields — the common case, since most
 * admin forms need a checkbox, a select, or a rich-text toolbar.
 */
export function useActionForm<T = undefined>(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState<T>>,
  options: {
    /** Toast tone for a success message. Defaults to 'success'. */
    successTone?: 'success' | 'info';
    /** Fires once per state change, after the toast. */
    onResult?: (state: ActionState<T>) => void;
  } = {},
) {
  const [state, formAction, pending] = useActionState(
    action as (prev: ActionState, formData: FormData) => Promise<ActionState>,
    INITIAL_ACTION_STATE,
  ) as [ActionState<T>, (formData: FormData) => void, boolean];
  const { toast } = useToast();
  const handled = useRef<ActionState<T> | null>(null);

  // Only these three are deps: `options` is a fresh object literal on every
  // render, so depending on it would re-run this effect every render. The ref
  // still guards against a re-render before a genuinely new state arrives.
  const { successTone, onResult } = options;

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.status === 'error' && state.formError) {
      toast(state.formError, 'error');
    } else if (state.status === 'success' && state.message) {
      toast(state.message, successTone ?? 'success');
    }
    onResult?.(state);
  }, [state, toast, successTone, onResult]);

  return {
    state,
    pending,
    /** Pass to `<form action={...}>`. */
    formAction,
    /** First message for `field`, or undefined. */
    errorFor: (field: string) =>
      state.status === 'error' ? state.fieldErrors?.[field]?.[0] : undefined,
  };
}

/**
 * Form-level banner for a failed write. Renders nothing unless the action errored.
 *
 * `tone-rose` sets the local `--tone` so the glyph reads the error colour from
 * the design system instead of a hardcoded hue.
 */
export function FormError<T = undefined>({ state }: { state: ActionState<T> }) {
  if (state.status !== 'error' || !state.formError) return null;
  return (
    <div className="form-alert form-alert-error tone-rose" role="alert">
      {/* `flex: none` inline: `.form-alert` has no `svg` rule, so a long message
          in a narrow column would otherwise squash the glyph. */}
      <AlertCircle size={15} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
      <span>{state.formError}</span>
    </div>
  );
}

/**
 * Labelled field with its action-state error wired up.
 *
 * Renders the label, the control, and the message together, so a form cannot
 * ship a field with no error slot. `hint` fills the gap under the control while
 * there is no error; the error replaces it rather than stacking with it.
 */
export function ActionField<T = undefined>({
  name,
  label,
  state,
  hint,
  children,
}: {
  name: string;
  label: string;
  state: ActionState<T>;
  /** Static help text under the control, hidden while an error is showing. */
  hint?: string;
  children: ReactNode;
}) {
  const message = state.status === 'error' ? state.fieldErrors?.[name]?.[0] : undefined;
  return (
    <div className="field">
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {children}
      {message ? (
        <div className="field-error" id={`${name}-error`} role="alert">
          {message}
        </div>
      ) : (
        hint && <div className="field-hint">{hint}</div>
      )}
    </div>
  );
}

/**
 * Grouped block of related fields.
 *
 * `.form-section` is the tinted inset panel in globals.css; the header carries
 * the optional glyph and the uppercase section label. Nothing here knows about
 * actions, so a section can hold any content a form needs.
 */
export function FormSection({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="form-section-header">
        {Icon && <Icon size={14} aria-hidden style={{ flex: 'none' }} />}
        <span>{title}</span>
      </div>
      {description && <p className="helper">{description}</p>}
      {children}
    </section>
  );
}

/** Right-aligned submit row with the divider above it. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>;
}
