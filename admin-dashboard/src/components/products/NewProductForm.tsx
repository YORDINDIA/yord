'use client';

import { useRouter } from 'next/navigation';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { createProductAction } from '@/server/actions/products';

/**
 * New-product form.
 *
 * The old inline `createProduct` threw the raw PostgREST message, which Next
 * renders as a full-page error overlay, and if the default-variant insert failed
 * it left an orphan product row with no variant. `createProductAction` rolls the
 * product row back and reports both failures in the form.
 */
export default function NewProductForm() {
  const router = useRouter();
  const { state, pending, formAction, errorFor } = useActionForm<{ id: number }>(
    createProductAction,
    {
      onResult: (result) => {
        if (result.status === 'success' && result.data?.id) {
          router.push(`/products/${result.data.id}`);
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
        />
      </ActionField>

      <ActionField name="vendor" label="Vendor" state={state}>
        <input className="input" id="vendor" name="vendor" defaultValue="YORD" />
      </ActionField>

      <ActionField name="product_type" label="Product Type" state={state}>
        <input className="input" id="product_type" name="product_type" defaultValue="Apparel" />
      </ActionField>

      <ActionField name="tags" label="Tags" state={state}>
        <input
          className="input"
          id="tags"
          name="tags"
          placeholder="comma separated"
          aria-invalid={Boolean(errorFor('tags'))}
        />
      </ActionField>

      <ActionField name="price" label="Price" state={state}>
        <input
          className="input"
          id="price"
          name="price"
          type="number"
          step="0.01"
          min={0}
          defaultValue={0}
          aria-invalid={Boolean(errorFor('price'))}
        />
      </ActionField>

      <ActionField name="inventory" label="Inventory" state={state}>
        <input
          className="input"
          id="inventory"
          name="inventory"
          type="number"
          min={0}
          step={1}
          defaultValue={0}
          aria-invalid={Boolean(errorFor('inventory'))}
        />
      </ActionField>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="body_html" label="Description (HTML)" state={state}>
          <textarea
            className="textarea"
            id="body_html"
            name="body_html"
            rows={6}
            aria-invalid={Boolean(errorFor('body_html'))}
          />
        </ActionField>
      </div>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Creating…' : 'Create Draft'}
      </button>
    </form>
  );
}
