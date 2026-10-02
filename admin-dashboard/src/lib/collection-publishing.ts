/**
 * Publish-guard rules for collections, as pure functions.
 *
 * The guard exists because the storefront header/footer link several collections:
 * publishing one that holds no products produced a linked, empty page (the
 * "Collections are not active" report). It lives here, outside the server
 * action, so both publish paths (edit form, create form) answer the same
 * question the same way — and so the rule is unit-tested against the real
 * module instead of being re-described in a test.
 *
 * Auto collections (`new-arrivals`, `all`) are not covered: the storefront
 * computes their products from `products`, so they are never empty. Their
 * publication state is preserved by the action instead of being derived from a
 * form that renders no publication control for them.
 */

export interface PublishCandidate {
  /** Auto handle (`new-arrivals` / `all`) — membership is computed, never empty. */
  isAuto: boolean;
  /** The value the submission is asking for. */
  published: boolean;
  /** `custom` | `smart` — a smart collection's membership is materialised by "Apply now". */
  collectionType: string;
  /** The product set this submission would leave in `collects`. */
  productIds: number[];
  /** Which form is asking, for copy that names the right escape hatch. */
  mode?: 'edit' | 'create';
}

export interface PublishRefusal {
  /** Form-level message (banner + toast). */
  message: string;
  /** Field-level message, attached to the picker's `product_ids` field. */
  fieldError: string;
}

const EMPTY_FIELD_ERROR = 'An empty collection cannot be published.';

/**
 * `null` when the submission may be written with `published = true`, otherwise
 * the refusal to show. Unpublishing is never blocked: an admin must always be
 * able to take a page down.
 */
export function refusePublish(candidate: PublishCandidate): PublishRefusal | null {
  if (!candidate.published) return null;
  if (candidate.isAuto) return null;
  if (candidate.productIds.length > 0) return null;

  const creating = candidate.mode === 'create';

  if (candidate.collectionType === 'smart') {
    // A smart collection's list is materialised by "Apply now", which can only
    // run once the collection exists; a brand-new smart collection therefore has
    // no products at all, and publishing it publishes an empty page.
    return {
      message: creating
        ? 'Create the smart collection unpublished, add its rules, then click "Apply now" and publish it.'
        : 'This smart collection has no products yet. Add its rules below and click "Apply now", or add products to the list, then publish.',
      fieldError: EMPTY_FIELD_ERROR,
    };
  }

  return {
    message: `Add at least one product before publishing, or ${creating ? 'create' : 'save'} it unpublished.`,
    fieldError: EMPTY_FIELD_ERROR,
  };
}
