'use client';

import { useRouter } from 'next/navigation';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { createCollectionAction } from '@/server/actions/collections';
import { COLLECTION_TYPES } from '@/lib/constants';

/**
 * New-collection form.
 *
 * The old inline action `throw`ed the raw PostgREST message on a failed insert,
 * which surfaced as a full-page error overlay instead of a form message, and it
 * threw again partway through attaching products — leaving a collection with a
 * partial product set and no way back into the form. The action now returns a
 * message for each case and redirects only after the whole thing committed.
 */
export default function NewCollectionForm() {
  const router = useRouter();
  const { state, pending, formAction, errorFor } = useActionForm<{ id: number }>(
    createCollectionAction,
    {
      onResult: (result) => {
        if (result.status === 'success' && result.data?.id) {
          router.push(`/collections/${result.data.id}`);
        }
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

      <ActionField name="handle" label="Handle" state={state}>
        <input
          className="input"
          id="handle"
          name="handle"
          placeholder="auto-generated if empty"
          aria-invalid={Boolean(errorFor('handle'))}
          aria-describedby={errorFor('handle') ? 'handle-error' : undefined}
        />
      </ActionField>

      <div>
        <label className="helper" htmlFor="collection_type">
          Collection Type
        </label>
        <select className="select" id="collection_type" name="collection_type" defaultValue="custom">
          {COLLECTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === 'custom' ? 'Custom' : 'Smart'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="helper" htmlFor="published">
          Publish
        </label>
        <input id="published" type="checkbox" name="published" />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="body_html" label="Description (HTML)" state={state}>
          <textarea
            className="textarea"
            id="body_html"
            name="body_html"
            rows={5}
            aria-invalid={Boolean(errorFor('body_html'))}
          />
        </ActionField>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="product_ids" label="Product IDs (for custom collection)" state={state}>
          <input
            className="input"
            id="product_ids"
            name="product_ids"
            placeholder="comma separated product ids"
            aria-invalid={Boolean(errorFor('product_ids'))}
          />
        </ActionField>
      </div>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Creating…' : 'Create Collection'}
      </button>
    </form>
  );
}
