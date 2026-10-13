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
 * The same page renders empty when every member is inactive (draft/archived),
 * because the storefront filters those out, so the guard refuses that case
 * too: the actions look the submitted ids' statuses up and pass `activeCount`.
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
  /**
   * How many of `productIds` are `status = 'active'`. The storefront renders
   * active products only, so a set with none is an empty page even when it is
   * not empty. `undefined` skips the check (callers that did not look the
   * statuses up); the actions always pass a number when publishing.
   */
  activeCount?: number;
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
const INACTIVE_FIELD_ERROR = 'A collection with no active products cannot be published.';

/**
 * `null` when the submission may be written with `published = true`, otherwise
 * the refusal to show. Unpublishing is never blocked: an admin must always be
 * able to take a page down.
 */
export function refusePublish(candidate: PublishCandidate): PublishRefusal | null {
  if (!candidate.published) return null;
  if (candidate.isAuto) return null;

  const creating = candidate.mode === 'create';

  if (candidate.productIds.length === 0) {
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

  // Products are submitted but none of them is active (draft, archived, or a
  // stale id whose row is gone). The storefront filters inactive products out,
  // so publishing still lands the linked empty page this guard exists to
  // prevent — it is just harder to see from the picker, which counts members,
  // not live ones.
  if (candidate.activeCount === 0) {
    return {
      message: `Every product in this collection is inactive, and the storefront shows active products only, so its page would be empty. Activate at least one product, or ${creating ? 'create' : 'save'} it unpublished.`,
      fieldError: INACTIVE_FIELD_ERROR,
    };
  }

  return null;
}
