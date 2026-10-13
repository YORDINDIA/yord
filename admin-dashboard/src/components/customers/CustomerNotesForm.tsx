'use client';

import { StickyNote } from 'lucide-react';
import {
  useActionForm,
  ActionField,
  FormActions,
  FormError,
  FormSection,
} from '@/components/forms/ActionForm';
import { updateCustomerAction } from '@/server/actions/orders';
import { tagList } from './display';

/**
 * Customer tags and notes.
 *
 * The old inline action dropped the Supabase error on the floor, so a rejected
 * save re-rendered the form with no change and no explanation. It now runs
 * through the shared `ActionForm` primitives: a form-level banner, per-field
 * messages from the shared zod schema, and a success toast.
 *
 * The action (`updateCustomerAction`) and the three field names (`id`, `tags`,
 * `note`) are unchanged — they are the contract with `customerSchema`.
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
  const existing = tagList(tags);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="id" value={customerId} />

      <FormError state={state} />

      <FormSection
        title="Tags & notes"
        icon={StickyNote}
        description="Internal record. Tags are comma-separated and are how segments are labelled."
      >
        {existing.length > 0 && (
          <div className="tag-list">
            {existing.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}

        <ActionField
          name="tags"
          label="Tags"
          state={state}
          hint="Comma-separated, e.g. vip, coldplay-2025, wholesale"
        >
          <input
            className="input"
            id="tags"
            name="tags"
            defaultValue={tags || ''}
            aria-invalid={Boolean(errorFor('tags'))}
            aria-describedby={errorFor('tags') ? 'tags-error' : undefined}
          />
        </ActionField>

        <ActionField
          name="note"
          label="Note"
          state={state}
          hint="Anything the next admin needs to know about this buyer."
        >
          <textarea
            className="textarea"
            id="note"
            name="note"
            rows={4}
            defaultValue={note || ''}
            aria-invalid={Boolean(errorFor('note'))}
            aria-describedby={errorFor('note') ? 'note-error' : undefined}
          />
        </ActionField>

        <FormActions>
          <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : 'Save notes'}
          </button>
        </FormActions>
      </FormSection>
    </form>
  );
}
