'use client';

import { useRouter } from 'next/navigation';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { createDiscountAction } from '@/server/actions/discounts';
import { DISCOUNT_VALUE_TYPES } from '@/lib/constants';

/**
 * New-discount form.
 *
 * The old inline action `throw`ed the raw PostgREST message on either insert
 * failure, so a rejected code left a `price_rules` row behind and rendered a
 * full-page error overlay instead of a field message. `createDiscountAction`
 * rolls the rule back, explains the duplicate-code case, and reports in the form.
 */
export default function NewDiscountForm() {
  const router = useRouter();
  const { state, pending, formAction, errorFor } = useActionForm<{ id: number }>(
    createDiscountAction,
    {
      onResult: (result) => {
        if (result.status === 'success' && result.data?.id) router.push('/discounts');
      },
    },
  );

  return (
    <form action={formAction} className="form-grid" noValidate>
      <FormError state={state} />

      <ActionField name="title" label="Title" state={state}>
        <input
          className="input"
          id="title"
          name="title"
          aria-invalid={Boolean(errorFor('title'))}
          aria-describedby={errorFor('title') ? 'title-error' : undefined}
        />
      </ActionField>

      <ActionField name="code" label="Code" state={state}>
        <input
          className="input"
          id="code"
          name="code"
          aria-invalid={Boolean(errorFor('code'))}
          aria-describedby={errorFor('code') ? 'code-error' : undefined}
        />
      </ActionField>

      <ActionField name="value" label="Value" state={state}>
        <input
          className="input"
          id="value"
          name="value"
          type="number"
          step="0.01"
          min={0}
          aria-invalid={Boolean(errorFor('value'))}
        />
      </ActionField>

      <div>
        <label className="helper" htmlFor="value_type">
          Value Type
        </label>
        <select className="select" id="value_type" name="value_type" defaultValue="percentage">
          {DISCOUNT_VALUE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
            </option>
          ))}
        </select>
      </div>

      <ActionField name="starts_at" label="Starts At" state={state}>
        <input className="input" id="starts_at" name="starts_at" type="datetime-local" />
      </ActionField>

      <ActionField name="ends_at" label="Ends At" state={state}>
        <input
          className="input"
          id="ends_at"
          name="ends_at"
          type="datetime-local"
          aria-invalid={Boolean(errorFor('ends_at'))}
        />
      </ActionField>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Creating…' : 'Create Discount'}
      </button>
    </form>
  );
}
