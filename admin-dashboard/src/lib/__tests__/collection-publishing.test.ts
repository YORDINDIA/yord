import { describe, expect, it } from 'vitest';
import { refusePublish } from '@/lib/collection-publishing';

/**
 * The publish guard.
 *
 * Publishing an empty collection is how the storefront nav ended up linking to
 * empty pages, so the guard matters more than its one-line shape suggests: it
 * runs before the write, on the product set the submission is *about* to leave
 * in `collects`, not on the rows already there. Getting that backwards would
 * make "add products and publish" fail and "remove everything and publish"
 * succeed — the exact inversion of both intents.
 */
const base = {
  isAuto: false,
  published: false,
  collectionType: 'custom',
  productIds: [] as number[],
};

describe('refusePublish', () => {
  it('allows publishing the collection being filled in the same submit', () => {
    // The edit form submits the picker's full selection; the guard must read
    // that set, not the stale `collects` rows from before the submit.
    expect(refusePublish({ ...base, published: true, productIds: [11, 12] })).toBeNull();
  });

  it('refuses publishing a custom collection whose submitted list is empty', () => {
    const refusal = refusePublish({ ...base, published: true, productIds: [] });
    expect(refusal?.fieldError).toContain('empty collection cannot be published');
    expect(refusal?.message).toContain('save it unpublished');
  });

  it('allows saving an empty collection unpublished', () => {
    expect(refusePublish({ ...base, published: false, productIds: [] })).toBeNull();
  });

  it('allows unpublishing a collection with no products', () => {
    // Taking a page down must never be blocked, guard or no guard.
    expect(refusePublish({ ...base, published: false, productIds: [] })).toBeNull();
    expect(refusePublish({ ...base, published: false, productIds: [11] })).toBeNull();
  });

  it('refuses publishing an empty smart collection, pointing at Apply now', () => {
    // A brand-new smart collection cannot have rules yet, so publishing it at
    // creation time always produced an empty page. Smart collections are not an
    // exemption: the guard covers them and names the step that fills the list.
    const refusal = refusePublish({
      ...base,
      published: true,
      collectionType: 'smart',
      productIds: [],
    });
    expect(refusal).not.toBeNull();
    expect(refusal?.message).toContain('Apply now');
  });

  it('names the create form\u2019s escape hatch when the collection does not exist yet', () => {
    const create = refusePublish({
      ...base,
      published: true,
      mode: 'create',
      collectionType: 'custom',
      productIds: [],
    });
    expect(create?.message).toContain('create it unpublished');

    const smartCreate = refusePublish({
      ...base,
      published: true,
      mode: 'create',
      collectionType: 'smart',
      productIds: [],
    });
    expect(smartCreate?.message).toContain('Create the smart collection unpublished');
  });

  it('allows publishing a smart collection once it has products', () => {
    expect(
      refusePublish({ ...base, published: true, collectionType: 'smart', productIds: [7] }),
    ).toBeNull();
  });

  it('never blocks an auto collection', () => {
    // `new-arrivals` / `all` are computed from `products`, so they are never
    // empty; the action preserves their publication state instead.
    expect(
      refusePublish({ ...base, isAuto: true, published: true, productIds: [] }),
    ).toBeNull();
    expect(refusePublish({ ...base, isAuto: true, published: false, productIds: [] })).toBeNull();
  });
});
