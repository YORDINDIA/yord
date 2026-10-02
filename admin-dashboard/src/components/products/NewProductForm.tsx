'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, IndianRupee, Package, Store, Tags } from 'lucide-react';
import {
  useActionForm,
  ActionField,
  FormActions,
  FormError,
  FormSection,
} from '@/components/forms/ActionForm';
import { createProductAction } from '@/server/actions/products';
import { handleSchema } from '@/lib/validation';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { slugify } from '@/lib/utils/sanitize';

/**
 * New-product form.
 *
 * The old inline `createProduct` threw the raw PostgREST message, which Next
 * renders as a full-page error overlay, and if the default-variant insert failed
 * it left an orphan product row with no variant. `createProductAction` rolls the
 * product row back and reports both failures in the form.
 *
 * Fields are unchanged (`title`, `handle`, `vendor`, `product_type`, `tags`,
 * `price`, `inventory`, `body_html`) and there is still no status control: a new
 * product always starts as a draft, which `newProductSchema` defaults.
 */
export default function NewProductForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');

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

  // Same rule the summary of the action uses: an empty handle is generated from
  // the title, so the preview shows exactly what the storefront path will be.
  const typedHandle = handle.trim();
  const slug = typedHandle || slugify(title, '');
  const handleInvalid = typedHandle !== '' && !handleSchema.safeParse(typedHandle).success;

  return (
    <form action={formAction} noValidate>
      <div className="stack">
        <FormError state={state} />

        <FormSection title="Basics" icon={Package}>
          <div className="grid-2">
            <ActionField name="title" label="Title" state={state} hint="The product name in the catalog and on the storefront.">
              <input
                className="input"
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={Boolean(errorFor('title'))}
                aria-describedby={errorFor('title') ? 'title-error' : undefined}
              />
            </ActionField>

            <ActionField
              name="handle"
              label="Handle"
              state={state}
              hint={
                handleInvalid
                  ? 'Handles allow lowercase letters, numbers, and dashes.'
                  : slug
                    ? `Storefront path: /products/${slug}`
                    : 'Leave empty to generate it from the title on save.'
              }
            >
              <input
                className="input"
                id="handle"
                name="handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="auto-generated if empty"
                aria-invalid={Boolean(errorFor('handle')) || handleInvalid}
                aria-describedby={errorFor('handle') ? 'handle-error' : undefined}
              />
            </ActionField>

            <ActionField name="vendor" label="Vendor" state={state}>
              <input className="input" id="vendor" name="vendor" defaultValue="YORD" />
            </ActionField>

            <ActionField name="product_type" label="Product type" state={state}>
              <input
                className="input"
                id="product_type"
                name="product_type"
                defaultValue="Apparel"
              />
            </ActionField>
          </div>
        </FormSection>

        <FormSection title="Pricing" icon={IndianRupee} description="Saved on the product's first variant.">
          <div className="grid-2">
            <ActionField name="price" label="Price (₹)" state={state}>
              <input
                className="input"
                id="price"
                name="price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                defaultValue={0}
                aria-invalid={Boolean(errorFor('price'))}
                aria-describedby={errorFor('price') ? 'price-error' : undefined}
              />
            </ActionField>

            <ActionField
              name="inventory"
              label="Inventory"
              state={state}
              hint={`Units on hand. At or below ${LOW_STOCK_THRESHOLD} the catalog marks the product low stock.`}
            >
              <input
                className="input"
                id="inventory"
                name="inventory"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                defaultValue={0}
                aria-invalid={Boolean(errorFor('inventory'))}
                aria-describedby={errorFor('inventory') ? 'inventory-error' : undefined}
              />
            </ActionField>
          </div>
        </FormSection>

        <FormSection title="Organization" icon={Tags} description="Comma separated. Tags drive keyword collections.">
          <ActionField name="tags" label="Tags" state={state}>
            <input
              className="input"
              id="tags"
              name="tags"
              placeholder="coldplay, tour, black"
              aria-invalid={Boolean(errorFor('tags'))}
              aria-describedby={errorFor('tags') ? 'tags-error' : undefined}
            />
          </ActionField>
        </FormSection>

        <FormSection
          title="Description"
          icon={FileText}
          description="Sanitized on save. Rendered on the storefront product page."
        >
          <ActionField name="body_html" label="Description (HTML)" state={state}>
            <textarea
              className="textarea"
              id="body_html"
              name="body_html"
              rows={8}
              aria-invalid={Boolean(errorFor('body_html'))}
              aria-describedby={errorFor('body_html') ? 'body_html-error' : undefined}
            />
          </ActionField>
        </FormSection>

        <FormActions>
          <span className="helper">
            <Store size={12} aria-hidden /> New products start as a draft — publish from the product
            page when it is ready.
          </span>
          <span className="spacer" />
          <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Creating…' : 'Create draft'}
          </button>
        </FormActions>
      </div>
    </form>
  );
}
