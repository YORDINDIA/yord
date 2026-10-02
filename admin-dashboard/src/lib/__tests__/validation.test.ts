import { describe, expect, it } from 'vitest';
import {
  articleSchema,
  checkboxSchema,
  collectionSchema,
  discountSchema,
  handleSchema,
  htmlSchema,
  newProductSchema,
  orderStatusSchema,
  parseVariantRows,
  productSchema,
  productIdsSchema,
  refundSchema,
  toggleAdminSchema,
} from '@/lib/validation';

/**
 * The shared zod schemas.
 *
 * Three validation styles used to coexist: ad-hoc `typeof` checks in API routes,
 * bare `if (!title) return` guards in inline actions, and a client-side rule in
 * `ProductEditor.tsx` that disagreed with the one the server applied. These pin
 * the one set of rules every write now goes through.
 */
describe('handleSchema', () => {
  it('accepts a slug', () => {
    expect(handleSchema.parse('coldplay-tour-2025')).toBe('coldplay-tour-2025');
  });

  it('accepts empty, so a handle can be auto-generated', () => {
    expect(handleSchema.parse('')).toBe('');
  });

  it('rejects spaces, capitals, and slashes', () => {
    expect(handleSchema.safeParse('Coldplay').success).toBe(false);
    expect(handleSchema.safeParse('cold play').success).toBe(false);
    expect(handleSchema.safeParse('a/b').success).toBe(false);
    expect(handleSchema.safeParse('a_b').success).toBe(false);
  });
});

describe('htmlSchema', () => {
  it('allows ordinary markup', () => {
    expect(htmlSchema.parse('<p>Hello <strong>world</strong></p>')).toContain('strong');
  });

  it('rejects script, style, and embedded elements', () => {
    // These columns are rendered with dangerouslySetInnerHTML downstream.
    expect(htmlSchema.safeParse('<script>alert(1)</script>').success).toBe(false);
    expect(htmlSchema.safeParse('<style>body{}</style>').success).toBe(false);
    expect(htmlSchema.safeParse('<iframe src="x"></iframe>').success).toBe(false);
    expect(htmlSchema.safeParse('<object data="x"></object>').success).toBe(false);
    expect(htmlSchema.safeParse('<embed src="x">').success).toBe(false);
  });
});

describe('productSchema', () => {
  const valid = {
    id: '42',
    title: '  Tour Tee  ',
    handle: 'tour-tee',
    status: 'active',
    tags: 'coldplay',
    body_html: '<p>cotton</p>',
  };

  it('coerces a form string id to a number and trims the title', () => {
    const parsed = productSchema.parse(valid);
    expect(parsed.id).toBe(42);
    expect(parsed.title).toBe('Tour Tee');
  });

  it('requires a title', () => {
    expect(productSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
  });

  it('restricts status to the known catalog states', () => {
    expect(productSchema.safeParse({ ...valid, status: 'deleted' }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, status: 'active' }).success).toBe(true);
  });

  it('rejects a non-positive or non-integer id', () => {
    expect(productSchema.safeParse({ ...valid, id: '0' }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, id: '-3' }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, id: '1.5' }).success).toBe(false);
  });
});

/** Exactly the fields `NewProductForm` renders — no `status` control exists. */
const VALID_NEW_PRODUCT = {
  title: 'Tour Tee',
  handle: '',
  tags: '',
  body_html: '<p>hi</p>',
  price: '4999',
  inventory: '10',
  vendor: 'YORD',
  product_type: 'Apparel',
};

describe('newProductSchema', () => {
  it('requires a non-negative price and integer inventory', () => {
    const base = {
      title: 'Tour Tee',
      handle: '',
      tags: '',
      body_html: '',
      price: '4999',
      inventory: '10',
    };
    expect(newProductSchema.parse(base).price).toBe(4999);
    expect(newProductSchema.safeParse({ ...base, price: '-1' }).success).toBe(false);
    expect(newProductSchema.safeParse({ ...base, inventory: '-1' }).success).toBe(false);
    expect(newProductSchema.safeParse({ ...base, inventory: '1.5' }).success).toBe(false);
  });

  it('accepts exactly what the create form submits, with no status field', () => {
    // The form renders only these inputs. An earlier test passed `status`
    // explicitly, which is why it kept passing while real submissions failed.
    const result = newProductSchema.safeParse(VALID_NEW_PRODUCT);

    expect(result.success).toBe(true);
    // New products start unpublished rather than requiring the admin to pick.
    expect(newProductSchema.parse(VALID_NEW_PRODUCT).status).toBe('draft');
  });

  it('still honors an explicit status when one is submitted', () => {
    expect(newProductSchema.parse({ ...VALID_NEW_PRODUCT, status: 'active' }).status).toBe('active');
  });
});

describe('productIdsSchema', () => {
  it('drops unparseable, zero, and negative ids', () => {
    // A typo in a comma-separated id list must not become id 0 in a
    // `collects` insert; the rest of the list still applies.
    expect(productIdsSchema.parse('1, 2,abc, 0, -4, 3')).toEqual([1, 2, 3]);
  });

  it('returns an empty list for empty input', () => {
    expect(productIdsSchema.parse('')).toEqual([]);
    expect(productIdsSchema.parse('   ')).toEqual([]);
  });
});

describe('collectionSchema', () => {
  it('coerces the published checkbox to a boolean', () => {
    const parsed = collectionSchema.parse({
      id: '7',
      title: 'Tour',
      handle: 'tour',
      published: 'on',
      body_html: '',
      product_ids: '1,2',
    });
    expect(parsed.published).toBe(true);
    expect(parsed.product_ids).toEqual([1, 2]);
  });
});

describe('orderStatusSchema', () => {
  it('accepts the vocabulary plus an unchanged imported status; leaves unknown statuses to the action', () => {
    const base = { order_id: '5', financial_status: 'paid', fulfillment_status: 'fulfilled' };
    expect(orderStatusSchema.safeParse(base).success).toBe(true);
    // Imported statuses ride through the schema so the form can round-trip an
    // unchanged persisted value; the write action enforces the allowlist
    // unless the submitted status equals the order's current one.
    expect(
      orderStatusSchema.safeParse({ ...base, financial_status: 'authorized' }).success,
    ).toBe(true);
    // The schema is deliberately permissive for status strings so an
    // unchanged imported value round-trips; the write action rejects a status
    // that is neither on the allowlist nor equal to the persisted value.
    expect(orderStatusSchema.safeParse({ ...base, fulfillment_status: 'shipped' }).success).toBe(true);
    expect(orderStatusSchema.safeParse({ ...base, order_id: '0' }).success).toBe(false);
  });
});

describe('articleSchema', () => {
  it('rejects script in either HTML column', () => {
    const base = {
      id: '3',
      title: 'Post',
      handle: 'post',
      author: 'YORD',
      tags: '',
      summary_html: '',
      body_html: '<p>ok</p>',
      published: 'on',
    };
    expect(articleSchema.safeParse({ ...base, body_html: '<script>x</script>' }).success).toBe(false);
    expect(articleSchema.safeParse({ ...base, summary_html: '<script>x</script>' }).success).toBe(false);
  });
});

describe('discountSchema', () => {
  it('requires an ends_at after starts_at', () => {
    const base = {
      title: 'Sale',
      code: 'YORD20',
      value: '20',
      value_type: 'percentage',
      starts_at: '2025-01-02T00:00:00.000Z',
      ends_at: '2025-01-01T00:00:00.000Z',
    };
    expect(discountSchema.safeParse(base).success).toBe(false);
    expect(
      discountSchema.safeParse({ ...base, ends_at: '2025-01-03T00:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('rejects a non-positive value and a code with spaces', () => {
    const base = {
      title: 'Sale',
      code: 'YORD20',
      value: '20',
      value_type: 'percentage',
      starts_at: '',
      ends_at: '',
    };
    expect(discountSchema.safeParse({ ...base, value: '0' }).success).toBe(false);
    expect(discountSchema.safeParse({ ...base, value: '-5' }).success).toBe(false);
    expect(discountSchema.safeParse({ ...base, code: 'YORD 20' }).success).toBe(false);
  });
});

describe('parseVariantRows', () => {
  it('accepts a valid array and coerces numeric strings', () => {
    const result = parseVariantRows(
      JSON.stringify([
        { id: '1', price: '499', compare_at_price: null, inventory_quantity: '5' },
        { id: 2, price: 0, compare_at_price: '999', inventory_quantity: 0 },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({ id: 1, price: 499, inventory_quantity: 5 });
  });

  it('returns a single readable message for malformed JSON', () => {
    // The old action JSON.parse'd a raw client blob and `continue`d past bad
    // rows, applying the good ones and leaving a partially-updated table.
    const result = parseVariantRows('{not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Malformed variant payload.');
  });

  it('rejects a non-array payload', () => {
    expect(parseVariantRows('{"id":1}').ok).toBe(false);
  });

  it('rejects negative price and inventory', () => {
    expect(
      parseVariantRows(JSON.stringify([{ id: 1, price: -1, compare_at_price: null, inventory_quantity: 0 }]))
        .ok,
    ).toBe(false);
    expect(
      parseVariantRows(
        JSON.stringify([{ id: 1, price: 1, compare_at_price: null, inventory_quantity: -3 }]),
      ).ok,
    ).toBe(false);
  });

  it('rejects a row with no id', () => {
    expect(parseVariantRows(JSON.stringify([{ price: 1 }])).ok).toBe(false);
  });
});

describe('refundSchema', () => {
  it('treats an empty amount as a full refund', () => {
    const result = refundSchema.parse({ orderId: '1', transactionId: 2, amount: '' });
    expect(result.amount).toBeUndefined();
  });

  it('accepts a positive amount and rejects zero or negative', () => {
    expect(refundSchema.parse({ orderId: '1', transactionId: 2, amount: '100' }).amount).toBe(100);
    expect(refundSchema.safeParse({ orderId: '1', transactionId: 2, amount: '0' }).success).toBe(false);
    expect(refundSchema.safeParse({ orderId: '1', transactionId: 2, amount: '-5' }).success).toBe(false);
  });

  it('requires a decimal-string order id and a positive transaction id', () => {
    expect(refundSchema.safeParse({ orderId: '0', transactionId: 2 }).success).toBe(false);
    expect(refundSchema.safeParse({ orderId: '1.5', transactionId: 2 }).success).toBe(false);
    expect(refundSchema.safeParse({ orderId: '9007199254740993', transactionId: 2 }).success).toBe(true);
    expect(refundSchema.safeParse({ orderId: '1', transactionId: 0 }).success).toBe(false);
  });
});

describe('checkboxSchema', () => {
  it('reads an absent checkbox as false', () => {
    // A browser omits an unchecked checkbox from FormData entirely, so
    // `parseForm` hands the schema `undefined`. `z.coerce.boolean()` rejected
    // that, which meant clearing "Published" on a collection or an article
    // produced a validation error instead of unpublishing it.
    expect(checkboxSchema.parse(undefined)).toBe(false);
    expect(checkboxSchema.parse(null)).toBe(false);
  });

  it('reads the values a checked box actually submits', () => {
    expect(checkboxSchema.parse('on')).toBe(true);
    expect(checkboxSchema.parse(true)).toBe(true);
    expect(checkboxSchema.parse('true')).toBe(true);
    expect(checkboxSchema.parse('1')).toBe(true);
    expect(checkboxSchema.parse(1)).toBe(true);
  });

  it('does not treat the string "false" as true', () => {
    // `z.coerce.boolean()` coerces any non-empty string to `true`, so a hidden
    // `is_active=false` field would have reactivated a deactivated admin.
    expect(checkboxSchema.parse('false')).toBe(false);
    expect(checkboxSchema.parse('FALSE')).toBe(false);
    expect(checkboxSchema.parse('0')).toBe(false);
    expect(checkboxSchema.parse('off')).toBe(false);
    expect(checkboxSchema.parse(0)).toBe(false);
    expect(checkboxSchema.parse('')).toBe(false);
  });
});

describe('checkbox fields in real form schemas', () => {
  const collectionBase = {
    id: '1',
    title: 'Tour',
    handle: 'tour',
    body_html: '',
    product_ids: '',
  };
  const articleBase = {
    id: '1',
    title: 'Post',
    handle: 'post',
    author: 'YORD',
    tags: '',
    summary_html: '',
    body_html: '<p>ok</p>',
  };

  it('unpublishes when the box is cleared, rather than rejecting', () => {
    const collection = collectionSchema.safeParse(collectionBase);
    expect(collection.success).toBe(true);
    if (collection.success) expect(collection.data.published).toBe(false);

    const article = articleSchema.safeParse(articleBase);
    expect(article.success).toBe(true);
    if (article.success) expect(article.data.published).toBe(false);
  });

  it('publishes when the box is checked', () => {
    const collection = collectionSchema.parse({ ...collectionBase, published: 'on' });
    expect(collection.published).toBe(true);
    const article = articleSchema.parse({ ...articleBase, published: 'on' });
    expect(article.published).toBe(true);
  });

  it('toggles an admin in the direction the button claims', () => {
    // AdminUsersPanel submits the row's CURRENT state in a hidden field and
    // flips it, so "false" must mean "currently deactivated, reactivate".
    const UUID = 'aaaaaaaa-0000-0000-0000-000000000000';
    expect(toggleAdminSchema.parse({ user_id: UUID, is_active: 'false' }).is_active).toBe(false);
    expect(toggleAdminSchema.parse({ user_id: UUID, is_active: 'true' }).is_active).toBe(true);
  });
});
