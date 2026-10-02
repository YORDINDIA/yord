'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useActionForm, ActionField, FormError, FormSection } from '@/components/forms/ActionForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CoverField from '@/components/collections/CollectionCoverPicker';
import ProductPicker from '@/components/collections/ProductPicker';
import { updateCollectionAction } from '@/server/actions/collections';
import {
  COLLECTION_SORT_ORDER_LABELS,
  COLLECTION_SORT_ORDERS,
  COLLECTION_TYPES,
  isAutoCollectionHandle,
} from '@/lib/constants';
import type { Collection } from '@yord/db-types';
import type { MediaAsset } from '@/lib/data/media';
import type { ProductPickerRow } from '@/lib/data/products';

/**
 * Collection editor.
 *
 * Product membership used to be a comma-separated list of bigint ids typed by
 * hand — impossible to verify and unusable at 463 products. It is now a
 * searchable picker (titles, thumbnails, reorder), submitting the same
 * `product_ids` field the action already parsed.
 *
 * Two guards were added on top:
 *  - publishing an empty custom collection is refused (client confirms, server
 *    enforces) because that is exactly how the nav ended up linking to empty
 *    pages;
 *  - auto collections (`new-arrivals`, `all`) render read-only, since their
 *    membership is computed by the storefront and the form's list is never read.
 */
export default function CollectionEditor({
  collection,
  productIds,
  products,
  memberCount,
  activeCount,
  assets,
}: {
  collection: Collection;
  productIds: number[];
  /** Light rows for the current members, in `collects` position order. */
  products: ProductPickerRow[];
  memberCount: number;
  /**
   * How many members are `active`. The storefront only renders active products,
   * so a collection can hold members and still show an empty page.
   */
  activeCount?: number;
  /** Server-provided window of library assets for the cover picker. */
  assets?: MediaAsset[];
}) {
  const { state, pending, formAction, errorFor } = useActionForm(updateCollectionAction);
  const formRef = useRef<HTMLFormElement>(null);
  const publishedRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<string>(collection.collection_type ?? 'custom');
  const [emptyPublish, setEmptyPublish] = useState(false);
  const [imageSrc, setImageSrc] = useState(collection.image_src ?? '');

  const isAuto = isAutoCollectionHandle(collection.handle);
  const effectiveType = isAuto ? 'custom' : type;

  /**
   * Intercept a publish of an empty collection before it reaches the server.
   *
   * Applies to smart collections too: their membership is materialised by
   * "Apply now", so a smart collection with nothing applied is just as empty on
   * the storefront.
   */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isAuto) return;
    if (!publishedRef.current?.checked) return;
    const field = event.currentTarget.elements.namedItem('product_ids');
    const value = field instanceof HTMLInputElement ? field.value.trim() : '';
    if (value === '') {
      event.preventDefault();
      setEmptyPublish(true);
    }
  }

  /** Modal escape hatch: keep the edits, drop the publish bit, submit again. */
  function saveUnpublished() {
    if (publishedRef.current) publishedRef.current.checked = false;
    setEmptyPublish(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="form-grid" noValidate onSubmit={onSubmit}>
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
          disabled={isAuto}
          aria-invalid={Boolean(errorFor('handle'))}
          aria-describedby="handle-hint"
        />
      </ActionField>
      {/* Same reason as the type select and the published box: a disabled input
          submits nothing, and an absent handle is regenerated from the title —
          which for this collection would delete the route the header links. */}
      {isAuto && <input type="hidden" name="handle" value={collection.handle ?? ''} />}
      <div className="helper" id="handle-hint" style={{ gridColumn: '1 / -1' }}>
        {isAuto ? (
          `Auto collection: /collection/${collection.handle} is linked from the storefront header and footer, so its handle is fixed.`
        ) : (
          <>The URL slug: /collection/&lt;handle&gt;. Changing it breaks existing links.</>
        )}
      </div>

      <div>
        <label className="helper" htmlFor="collection_type">
          Collection type
        </label>
        <select
          className="select"
          id="collection_type"
          name="collection_type"
          value={effectiveType}
          onChange={(event) => setType(event.target.value)}
          disabled={isAuto}
        >
          {COLLECTION_TYPES.map((option) => (
            <option key={option} value={option}>
              {option === 'custom' ? 'Custom (hand-picked products)' : 'Smart (rule-based)'}
            </option>
          ))}
        </select>
        {/* A disabled control is not submitted at all, and the action would read
            the missing field as the schema default ('custom'). An auto handle's
            type is not editable, so it round-trips through a hidden field. */}
        {isAuto && <input type="hidden" name="collection_type" value={collection.collection_type} />}
        {effectiveType === 'smart' && !isAuto && (
          <div className="helper" style={{ marginTop: 4 }}>
            Rules live below. Use “Apply now” to copy the current matches into this collection.
          </div>
        )}
      </div>

      <div>
        <label className="helper" htmlFor="sort_order">
          Default product order
        </label>
        <select
          className="select"
          id="sort_order"
          name="sort_order"
          defaultValue={collection.sort_order ?? ''}
        >
          <option value="">Newest first (default)</option>
          {COLLECTION_SORT_ORDERS.filter((option) => option !== 'newest').map((option) => (
            <option key={option} value={option}>
              {COLLECTION_SORT_ORDER_LABELS[option]}
            </option>
          ))}
        </select>
        <div className="helper" style={{ marginTop: 4 }}>
          Used when a shopper has not picked a sort on the storefront.
        </div>
      </div>

      <div>
        <label className="helper" htmlFor="published">
          Published
        </label>
        <input
          ref={publishedRef}
          id="published"
          type="checkbox"
          name="published"
          defaultChecked={collection.published ?? false}
          disabled={isAuto}
        />
        {/* Same reason as the type select: this box is disabled for an auto
            handle, and an absent checkbox reads as `false`. Without this hidden
            field a Save silently unpublished `new-arrivals` / `all`, which
            404s the storefront header links. */}
        {isAuto && <input type="hidden" name="published" value={collection.published ? 'on' : ''} />}
        {isAuto && (
          <div className="helper" style={{ marginTop: 4 }}>
            Auto collection: products are computed by the storefront, and the header links it, so its
            publication state is left as it is.
          </div>
        )}
      </div>

      {effectiveType === 'smart' && !isAuto && (
        <div>
          <label className="helper" htmlFor="disjunctive">
            Match any rule (OR)
          </label>
          <input
            id="disjunctive"
            type="checkbox"
            name="disjunctive"
            defaultChecked={collection.disjunctive ?? false}
          />
          <div className="helper" style={{ marginTop: 4 }}>
            Off = a product must match every rule.
          </div>
        </div>
      )}

      <div style={{ gridColumn: '1 / -1' }}>
        <FormSection
          title="Cover"
          description="Pick a cover from the media library. The storefront falls back to the legacy URL when no cover is set."
        >
          <CoverField
            assets={assets ?? []}
            storageValue={collection.storage_image_url ?? ''}
            legacyValue={collection.image_src ?? ''}
          />
          <ActionField
            name="image_src"
            label="Legacy image URL (optional)"
            state={state}
            hint="Pre-migration image. Used only when no library cover is set."
          >
            <input
              className="input"
              id="image_src"
              name="image_src"
              defaultValue={collection.image_src ?? ''}
              placeholder="https://… or a /public path"
              aria-invalid={Boolean(errorFor('image_src'))}
              onChange={(event) => setImageSrc(event.target.value)}
            />
          </ActionField>
          {imageSrc.startsWith('http') && (
            <Image
              src={imageSrc}
              alt="Legacy image preview"
              width={180}
              height={120}
              style={{ marginTop: 8, borderRadius: 10, objectFit: 'cover' }}
            />
          )}
        </FormSection>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="body_html" label="Description (HTML)" state={state}>
          <textarea
            className="textarea"
            id="body_html"
            name="body_html"
            rows={4}
            defaultValue={collection.body_html || ''}
            aria-invalid={Boolean(errorFor('body_html'))}
          />
        </ActionField>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="product_ids" label="Products" state={state}>
          <ProductPicker
            initialSelected={products}
            memberCount={memberCount}
            disabled={isAuto}
          />
        </ActionField>
        {productIds.length === 0 && !isAuto && (
          <div className="helper" style={{ marginTop: 6 }}>
            No products yet — this collection stays unpublished until it has at least one.
          </div>
        )}
        {!isAuto && typeof activeCount === 'number' && memberCount > activeCount && (
          <div className="helper" style={{ marginTop: 6 }}>
            Only {activeCount} of {memberCount} members are <strong>active</strong>. The storefront
            shows active products only, so an inactive-only collection renders empty even when
            published.
          </div>
        )}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Save Collection'}
        </button>
      </div>

      <ConfirmModal
        open={emptyPublish}
        title="Publish an empty collection?"
        body={
          effectiveType === 'smart'
            ? 'A smart collection shows the products “Apply now” put in it, and this one has none. Add products, apply its rules, or save it unpublished and publish later.'
            : 'Publishing a collection with no products creates an empty storefront page. Add products, or save it unpublished and publish later.'
        }
        confirmLabel="Save unpublished"
        cancelLabel="Keep editing"
        onConfirm={saveUnpublished}
        onClose={() => setEmptyPublish(false)}
      />
    </form>
  );
}
