'use client';

import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import {
  useActionForm,
  ActionField,
  FormActions,
  FormError,
  FormSection,
} from '@/components/forms/ActionForm';
import { addProductImageAction } from '@/server/actions/products';
import styles from './products.module.css';

/**
 * Add-a-product-image form.
 *
 * Was a bare `<form action={addImage}>` living inside `products/[id]/page.tsx`,
 * where `addImage` validated the URL and silently `return`ed when it did not
 * fit. Field errors now come back through the shared action state; the field
 * names (`product_id`, `image_url`, `alt`) and the reset-on-success are
 * unchanged.
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
    <form ref={formRef} action={formAction} noValidate className={styles.addForm}>
      <input type="hidden" name="product_id" value={productId} />

      <FormSection
        title="Add image"
        icon={ImagePlus}
        description="Paste a public image URL. New uploads belong in the media library."
      >
        <FormError state={state} />

        <div className="grid-2">
          <ActionField
            name="image_url"
            label="Image URL"
            state={state}
            hint="https://… or a root-relative path."
          >
            <input
              className="input"
              id="image_url"
              name="image_url"
              placeholder="https://cdn.example.com/product.webp"
              aria-invalid={Boolean(errorFor('image_url'))}
              aria-describedby={errorFor('image_url') ? 'image_url-error' : undefined}
            />
          </ActionField>

          <ActionField
            name="alt"
            label="Alt text"
            state={state}
            hint="Describe the image for screen readers and search."
          >
            <input
              className="input"
              id="alt"
              name="alt"
              aria-invalid={Boolean(errorFor('alt'))}
              aria-describedby={errorFor('alt') ? 'alt-error' : undefined}
            />
          </ActionField>
        </div>

        <FormActions>
          <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Adding…' : 'Add image'}
          </button>
        </FormActions>
      </FormSection>
    </form>
  );
}
