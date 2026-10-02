'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { updateCustomerAction } from '@/server/actions/orders';

/**
 * Customer tags and notes.
 *
 * The old inline action dropped the Supabase error on the floor, so a rejected
 * save re-rendered the form with no change and no explanation.
 */
export default function CustomerNotesForm({
  customerId,
  tags,
  note,
}: {
  customerId: number;
  tags: string | null;
  note: string | null;
}) {
  const { state, pending, formAction, errorFor } = useActionForm(updateCustomerAction);

  return (
    <form action={formAction} className="form-grid" style={{ marginTop: 16 }} noValidate>
      <input type="hidden" name="id" value={customerId} />

      <FormError state={state} />

      <ActionField name="tags" label="Tags" state={state}>
        <input
          className="input"
          id="tags"
          name="tags"
          defaultValue={tags || ''}
          aria-invalid={Boolean(errorFor('tags'))}
        />
      </ActionField>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="note" label="Note" state={state}>
          <textarea
            className="textarea"
            id="note"
            name="note"
            rows={4}
            defaultValue={note || ''}
            aria-invalid={Boolean(errorFor('note'))}
          />
        </ActionField>
      </div>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save Notes'}
      </button>
    </form>
  );
}
