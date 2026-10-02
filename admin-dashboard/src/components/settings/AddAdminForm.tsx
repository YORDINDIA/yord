'use client';

import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, ShieldPlus, UserPlus } from 'lucide-react';
import {
  ActionField,
  FormActions,
  FormError,
  FormSection,
  useActionForm,
} from '@/components/forms/ActionForm';
import { addAdminAction } from '@/server/actions/settings';
import { adminUserSchema } from '@/lib/validation';
import type { ActionState } from '@/lib/action-state';
import styles from './settings.module.css';

/**
 * Grant an existing Supabase account admin access.
 *
 * The field is `user_id` and holds an `auth.users` id — the same shape
 * `adminUserSchema` validates on the server, and this form runs that schema
 * first with `safeParse` so a typo is answered instantly instead of after a
 * round trip. Server-side validation is unchanged and still the boundary.
 *
 * Feedback is deliberately doubled: `useActionForm` toasts the outcome (so a
 * scrolled-away admin still sees it), and the section itself shows the result —
 * success clears the field and confirms inline, a failure keeps the value the
 * admin typed.
 */
export default function AddAdminForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const onResult = useCallback((result: ActionState) => {
    if (result.status !== 'success') return;
    // The action revalidates the table above; this only resets *this* form.
    formRef.current?.reset();
    setLocalError(null);
  }, []);

  const add = useActionForm(addAdminAction, { onResult });
  const fieldError = add.errorFor('user_id');
  const describedBy = fieldError
    ? 'user_id-error'
    : localError
      ? 'user_id-local-error'
      : undefined;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const value = String(new FormData(event.currentTarget).get('user_id') ?? '');
    const parsed = adminUserSchema.safeParse({ user_id: value });
    if (parsed.success) {
      setLocalError(null);
      return;
    }
    // Only a failed *format* is intercepted; everything else is the action's.
    event.preventDefault();
    setLocalError(parsed.error.issues[0]?.message ?? 'Enter a valid Supabase user UUID.');
  }

  return (
    <>
      <div className="card-header">
        <div>
          <h2 className="section-title">Add an administrator</h2>
          <p className="helper">
            The account must already exist in Supabase Auth. This grants it access to every admin
            route; it does not create a user.
          </p>
        </div>
      </div>

      <form ref={formRef} action={add.formAction} onSubmit={onSubmit} noValidate>
        <div className="stack">
          <FormError state={add.state} />

          {/* The success banner is gated on `!localError`: state stays
              `success` until the next submission resolves, so a typo'd second
              attempt would otherwise show "Admin added." next to a format
              error. */}
          {!localError && add.state.status === 'success' && add.state.message && (
            <div className="form-alert form-alert-success tone-emerald" role="status">
              <CheckCircle2 size={15} className={`tone-icon ${styles.alertIcon}`} aria-hidden />
              <span>{add.state.message}</span>
            </div>
          )}

          <FormSection
            title="Account"
            icon={UserPlus}
            description="Copy the id from Supabase → Authentication → Users. It is the account's UUID, not its email."
          >
            <ActionField
              name="user_id"
              label="Supabase user ID"
              state={add.state}
              hint="8-4-4-4-12 hex, e.g. 3f9c1a4e-9c1f-4a3b-8e2d-1b7c5d0a9f21."
            >
              <input
                className="input mono"
                id="user_id"
                name="user_id"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="00000000-0000-0000-0000-000000000000"
                required
                aria-invalid={Boolean(fieldError || localError)}
                aria-describedby={describedBy}
              />
            </ActionField>

            {localError && (
              <div className="field-error" id="user_id-local-error" role="alert">
                {localError}
              </div>
            )}
          </FormSection>

          <FormActions>
            <span className="helper">
              <ShieldPlus size={14} aria-hidden /> New admins are added active.
            </span>
            <span className="spacer" />
            <button className="button primary" type="submit" disabled={add.pending} aria-busy={add.pending}>
              {add.pending ? 'Adding…' : 'Add administrator'}
            </button>
          </FormActions>
        </div>
      </form>
    </>
  );
}
