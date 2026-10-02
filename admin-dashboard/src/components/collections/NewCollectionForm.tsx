'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Image as ImageIcon, Send, ShoppingBag, Tags } from 'lucide-react';
import {
  ActionField,
  FormActions,
  FormError,
  FormSection,
  useActionForm,
} from '@/components/forms/ActionForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CoverField from '@/components/collections/CollectionCoverPicker';
import ProductPicker from '@/components/collections/ProductPicker';
import { createCollectionAction } from '@/server/actions/collections';
import type { MediaAsset } from '@/lib/data/media';
import {
  COLLECTION_SORT_ORDER_LABELS,
  COLLECTION_SORT_ORDERS,
  COLLECTION_TYPES,
} from '@/lib/constants';

/**
 * New-collection form, grouped into the same sections the editor reads:
 * Basics / Cover / Description / Products / Publishing.
 *
 * The old inline action `throw`ed the raw PostgREST message on a failed insert,
 * which surfaced as a full-page error overlay instead of a form message, and it
 * threw again partway through attaching products — leaving a collection with a
 * partial product set and no way back into the form. The action now returns a
 * message for each case and redirects only after the whole thing committed.
 *
 * Products are chosen with the same picker the editor uses; the comma-separated
 * id box is gone. Publishing an empty custom collection is intercepted here and
 * refused by the action.
 *
 * The cover is a `CoverField` (library picker + hidden `storage_image_url`),
 * with the old `image_src` URL input kept beside it as the legacy override the
 * storefront falls back to when no library cover is chosen.
 */
export default function NewCollectionForm({ assets }: { assets: MediaAsset[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const publishedRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<string>('custom');
  const [emptyPublish, setEmptyPublish] = useState(false);
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

  /**
   * Intercept a publish of an empty collection before it reaches the server.
   *
   * The picker is only rendered for the custom type, so a smart submission is
   * always empty — and a brand-new smart collection cannot have rules yet, so
   * publishing it at creation time would publish an empty page.
   */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!publishedRef.current?.checked) return;
    const field = event.currentTarget.elements.namedItem('product_ids');
    const value = field instanceof HTMLInputElement ? field.value.trim() : '';
    if (value === '') {
      event.preventDefault();
      setEmptyPublish(true);
    }
  }

  function saveUnpublished() {
    if (publishedRef.current) publishedRef.current.checked = false;
    setEmptyPublish(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="stack" noValidate onSubmit={onSubmit}>
      <FormError state={state} />

      <FormSection title="Basics" icon={Tags}>
        <div className="grid-2">
          <ActionField name="title" label="Title" state={state}>
            <input
              className="input"
              id="title"
              name="title"
              autoComplete="off"
              aria-invalid={Boolean(errorFor('title'))}
            />
          </ActionField>

          <ActionField name="handle" label="Handle" state={state} hint="Leave empty to auto-generate from the title.">
            <input
              className="input"
              id="handle"
              name="handle"
              placeholder="auto-generated if empty"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errorFor('handle'))}
            />
          </ActionField>
        </div>

        <div className="grid-2">
          <ActionField
            name="collection_type"
            label="Collection type"
            state={state}
            hint={
              type === 'smart'
                ? 'Create it first, then add rules and click “Apply now” on the collection page.'
                : undefined
            }
          >
            <select
              className="select"
              id="collection_type"
              name="collection_type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {COLLECTION_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option === 'custom' ? 'Custom (hand-picked products)' : 'Smart (rule-based)'}
                </option>
              ))}
            </select>
          </ActionField>

          <ActionField name="sort_order" label="Default product order" state={state}>
            <select className="select" id="sort_order" name="sort_order" defaultValue="">
              <option value="">Newest first (default)</option>
              {COLLECTION_SORT_ORDERS.filter((option) => option !== 'newest').map((option) => (
                <option key={option} value={option}>
                  {COLLECTION_SORT_ORDER_LABELS[option]}
                </option>
              ))}
            </select>
          </ActionField>
        </div>
      </FormSection>

      <FormSection
        title="Cover"
        icon={ImageIcon}
        description="Shown on the storefront collection page. Without one it falls back to the static hero."
      >
        <ActionField
          name="storage_image_url"
          label="Library cover"
          state={state}
          hint="Chosen from the media library; the storefront uses this before the legacy URL below."
        >
          <CoverField assets={assets} storageValue="" />
        </ActionField>

        <ActionField
          name="image_src"
          label="Image URL (legacy override)"
          state={state}
          hint="Only used when no library cover is chosen."
        >
          <input
            className="input"
            id="image_src"
            name="image_src"
            placeholder="https://… or a /public path"
            spellCheck={false}
            aria-invalid={Boolean(errorFor('image_src'))}
          />
        </ActionField>
      </FormSection>

      <FormSection title="Description" icon={FileText}>
        <ActionField
          name="body_html"
          label="Description (HTML)"
          state={state}
          hint="Rendered below the product grid. HTML is sanitized on save."
        >
          <textarea
            className="textarea"
            id="body_html"
            name="body_html"
            rows={4}
            aria-invalid={Boolean(errorFor('body_html'))}
          />
        </ActionField>
      </FormSection>

      {type === 'custom' && (
        <FormSection
          title="Products"
          icon={ShoppingBag}
          description="Search and add products now; you can reorder or remove them on the collection page."
        >
          <ActionField name="product_ids" label="Products" state={state}>
            <ProductPicker initialSelected={[]} />
          </ActionField>
        </FormSection>
      )}

      <FormSection title="Publishing" icon={Send}>
        <label className="checkbox-row" htmlFor="published">
          <input ref={publishedRef} id="published" type="checkbox" name="published" />
          <span className="helper-strong">Publish as soon as it is created</span>
        </label>
        <p className="helper">
          Publishing an empty collection is refused — you will be asked to create it as a draft
          instead.
        </p>
      </FormSection>

      <FormActions>
        <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Creating…' : 'Create Collection'}
        </button>
      </FormActions>

      <ConfirmModal
        open={emptyPublish}
        title="Publish an empty collection?"
        body={
          type === 'smart'
            ? 'A new smart collection has no products until you add rules and click “Apply now”. Create it unpublished, then publish it once it has products.'
            : 'Publishing a collection with no products creates an empty storefront page. Add products, or create it unpublished and publish later.'
        }
        confirmLabel="Create unpublished"
        cancelLabel="Keep editing"
        onConfirm={saveUnpublished}
        onClose={() => setEmptyPublish(false)}
      />
    </form>
  );
}
