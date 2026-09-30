'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { updateCollectionAction } from '@/server/actions/collections';
import type { Collection } from '@yord/db-types';

/**
 * Collection editor.
 *
 * The product-ids field is a comma-separated list, which is what the old form
 * used too; the difference is that a rejected id, an unparseable id list, or a
 * failed write now comes back as a field error or a banner instead of a silent
 * no-op. The replace itself is atomic, so a partial product set is no longer
 * reachable.
 */
export default function CollectionEditor({
  collection,
  productIds,
}: {
  collection: Collection;
  productIds: number[];
}) {
  const { state, pending, formAction, errorFor } = useActionForm(updateCollectionAction);

  return (
    <form action={formAction} className="form-grid" noValidate>
      <input type="hidden" name="id" value={collection.id} />

      <FormError state={state} />

      <ActionField name="title" label="Title" state={state}>
        <input
          className="input"
          id="title"
          name="title"
          defaultValue={collection.title || ''}
          aria-invalid={Boolean(errorFor('title'))}
        />
      </ActionField>

      <ActionField name="handle" label="Handle" state={state}>
        <input
          className="input"
          id="handle"
          name="handle"
          defaultValue={collection.handle || ''}
          aria-invalid={Boolean(errorFor('handle'))}
        />
      </ActionField>

      <div>
        <label className="helper" htmlFor="published">
          Published
        </label>
        <input
          id="published"
          type="checkbox"
          name="published"
          defaultChecked={collection.published ?? false}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="body_html" label="Description (HTML)" state={state}>
          <textarea
            className="textarea"
            id="body_html"
            name="body_html"
            rows={5}
            defaultValue={collection.body_html || ''}
            aria-invalid={Boolean(errorFor('body_html'))}
          />
        </ActionField>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="product_ids" label="Product IDs (custom collections)" state={state}>
          <input
            className="input"
            id="product_ids"
            name="product_ids"
            defaultValue={productIds.join(', ')}
            aria-invalid={Boolean(errorFor('product_ids'))}
            aria-describedby="product_ids-hint"
          />
        </ActionField>
        <div className="helper" id="product_ids-hint">
          Comma-separated bigint ids. Invalid entries are dropped; the rest are
          replaced in one transaction.
        </div>
      </div>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save Collection'}
      </button>
    </form>
  );
}
