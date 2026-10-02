'use client';

import { useRef } from 'react';
import { useActionForm, ActionField } from '@/components/forms/ActionForm';
import { addProductImageAction } from '@/server/actions/products';

/**
 * Add-a-product-image form.
 *
 * Was a bare `<form action={addImage}>` living inside `products/[id]/page.tsx`,
 * where `addImage` validated the URL and silently `return`ed when it did not
 * fit. Field errors now come back through the shared action state.
 */
export default function AddImageForm({ productId }: { productId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, formAction, errorFor } = useActionForm(addProductImageAction, {
    onResult: (result) => {
      // Clear the URL/alt fields on success; keeping the URL would make the next
      // click a duplicate insert.
      if (result.status === 'success') formRef.current?.reset();
    },
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      className="form-grid"
      style={{ marginTop: 16 }}
      noValidate
    >
      <input type="hidden" name="product_id" value={productId} />

      <ActionField name="image_url" label="Image URL" state={state}>
        <input
          className="input"
          id="image_url"
          name="image_url"
          placeholder="Supabase URL or CDN URL"
          aria-invalid={Boolean(errorFor('image_url'))}
          aria-describedby={errorFor('image_url') ? 'image_url-error' : undefined}
        />
      </ActionField>

      <ActionField name="alt" label="Alt Text" state={state}>
        <input className="input" id="alt" name="alt" />
      </ActionField>

      <button className="button" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Adding…' : 'Add Image'}
      </button>
    </form>
  );
}
