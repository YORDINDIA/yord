import { z } from 'zod';
import {
  COLLECTION_SORT_ORDERS,
  COLLECTION_TYPES,
  DISCOUNT_VALUE_TYPES,
  PRODUCT_STATUSES,
  SMART_RULE_COLUMNS,
  SMART_RULE_RELATIONS,
} from '@/lib/constants';

/**
 * One validation approach for the whole admin app.
 *
 * Three styles used to coexist: ad-hoc `typeof` checks in API routes, bare
 * `if (!title) return` guards in inline actions, and a *different* client-side
 * rule in `ProductEditor.tsx` than the one the server applied. These schemas
 * are the single source, imported by the client (`safeParse` for hint text) and
 * by the server action before any write.
 */

/** Handles are URL slugs: lowercase alphanumerics and dashes. */
export const handleSchema = z
  .string()
  .trim()
  .max(255)
  .refine((v) => v === '' || /^[a-z0-9-]+$/.test(v), {
    message: 'Use lowercase letters, numbers, and dashes only.',
  });

export const htmlSchema = z
  .string()
  .trim()
  .max(200_000)
  // The value is stored as-is (after sanitization) and later rendered with
  // dangerouslySetInnerHTML, so block the obvious script/style vectors at the
  // schema boundary in addition to lib/utils/sanitize.ts.
  .refine((v) => !/<\s*(script|style|iframe|object|embed)\b/i.test(v), {
    message: 'Script, style, and embedded content are not allowed.',
  });

export const tagsSchema = z.string().trim().max(500);

/**
 * An HTML checkbox, as a form actually submits it.
 *
 * A browser omits an unchecked checkbox from `FormData` entirely, so
 * `parseForm` hands this schema `undefined` for a box the admin just cleared.
 * `z.coerce.boolean()` rejects that (`expected boolean, received undefined`),
 * which means un-ticking "Published" or "Published" on an article produced a
 * validation error instead of unpublishing it. `z.coerce.boolean()` is also
 * wrong for the string `"false"`, which it turns into `true`.
 *
 * This accepts every shape a checkbox can actually produce — absent, `"on"`,
 * `"true"`, `"1"`, `true` — and only `"false"`/`"0"`/`"off"` read as false.
 * The pre-migration code did the equivalent with
 * `formData.get('published') === 'on'`.
 */
export const checkboxSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    return !(normalized === '' || normalized === 'false' || normalized === '0' || normalized === 'off');
  },
  z.boolean(),
);

/**
 * Comma-separated product ids, as the collection picker submits them.
 *
 * Optional: the new-collection form renders the picker only for a custom
 * collection, so a smart collection's submission carries no `product_ids` field
 * at all (the browser omits the input entirely). Requiring the string made
 * "create a smart collection" fail validation with a field error for a control
 * that is not on the page — the documented smart-collection workflow was
 * unreachable. Absent means "no products", which is what the transform returns.
 */
export const productIdsSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
  );

// ─── Products ─────────────────────────────────────────────────────────────────

export const productStatusSchema = z.enum(PRODUCT_STATUSES);

export const productSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, 'Title is required.').max(255),
  handle: handleSchema,
  status: productStatusSchema,
  tags: tagsSchema,
  body_html: htmlSchema,
});

export const newProductSchema = productSchema
  .omit({ id: true, status: true })
  .extend({
    vendor: z.string().trim().max(255).default('YORD'),
    product_type: z.string().trim().max(255).default('Apparel'),
    price: z.coerce.number().min(0, 'Price cannot be negative.'),
    inventory: z.coerce.number().int().min(0, 'Inventory cannot be negative.'),
    // The create form has no status control, so a new product always starts as
    // a draft. Before this, `status` was inherited as required from
    // `productSchema` and EVERY product creation failed validation with
    // "Invalid option: expected one of active|draft|archived" — the form's
    // `success` branch was unreachable, so the admin saw a field error for a
    // field that does not exist on the page.
    status: productStatusSchema.default('draft'),
  });

export const productImageSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  image_url: z
    .string()
    .trim()
    .min(1, 'Image URL is required.')
    .refine((v) => v.startsWith('https://') || v.startsWith('/'), {
      message: 'Use an https URL or a root-relative path.',
    }),
  alt: z.string().trim().max(255),
});

export const imageIdSchema = z.object({
  image_id: z.coerce.number().int().positive(),
});

/** One row of the variant bulk editor. */
const variantRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  price: z.coerce.number().min(0).nullable().default(null),
  compare_at_price: z.coerce.number().min(0).nullable().default(null),
  inventory_quantity: z.coerce.number().int().min(0).nullable().default(null),
  // Field-aware inventory: the client sets this only when the admin actually
  // changed the stock field. Without it, a price-only edit resubmitted the
  // page-load inventory and silently restored stock a checkout had decremented.
  include_inventory: z.boolean().default(false),
});

export type VariantRowInput = z.infer<typeof variantRowSchema>;

/**
 * `path: message` for a zod error's first issue, `fallback` when it has none.
 * `rootPath` names issues raised on the root value (an empty path).
 */
export function firstIssue(error: z.ZodError, fallback: string, rootPath?: string): string {
  const first = error.issues[0];
  if (!first) return fallback;
  const field = first.path.join('.') || rootPath;
  return field ? `${field}: ${first.message}` : first.message;
}

/**
 * Parse and validate the serialized variant rows.
 *
 * `payload` is a JSON array the client serializes, so it is never trusted: the
 * old action `JSON.parse`d a raw client blob and applied rows one at a time,
 * leaving a partially-applied update behind on the first failure. A separate
 * function (rather than a zod `.transform`) keeps the failure a single readable
 * message, which is what the action's form-level error shows.
 */
export function parseVariantRows(
  payload: string,
): { ok: true; rows: VariantRowInput[] } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { ok: false, message: 'Malformed variant payload.' };
  }
  const result = z.array(variantRowSchema).safeParse(parsed);
  if (!result.success) {
    return { ok: false, message: firstIssue(result.error, 'Invalid variants.') };
  }
  return { ok: true, rows: result.data };
}

// ─── Collections ──────────────────────────────────────────────────────────────

/** Optional image URL for a collection (absolute URL or site-relative path). */
export const imageSrcSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v) || v.startsWith('/'), {
    message: 'Use an https:// URL or a path starting with /.',
  });

/**
 * Fields shared by the create and edit forms.
 *
 * `product_ids` stays a comma-joined string: the editor's product picker
 * submits a hidden input in exactly the format the schema already parsed, so
 * the atomic `set_collection_products` RPC and its 1000-row paging contract
 * are untouched.
 */
const collectionBaseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(255),
  handle: handleSchema,
  collection_type: z.enum(COLLECTION_TYPES).default('custom'),
  published: checkboxSchema,
  body_html: htmlSchema,
  product_ids: productIdsSchema,
  image_src: imageSrcSchema.default(''),
  // Cover chosen from the media library. The storefront resolves a cover as
  // `storage_image_url` → `image_src` → a static hero, so this is the column the
  // picker writes and `image_src` stays the legacy/override field.
  storage_image_url: imageSrcSchema.default(''),
  // Default storefront order for this collection's products; '' = newest.
  sort_order: z.enum(['', ...COLLECTION_SORT_ORDERS]).default(''),
  // Smart collections whose rules are ORed instead of ANDed (the DB column is
  // `disjunctive`; Shopify uses the same name for "any condition").
  disjunctive: checkboxSchema.default(false),
});

export const collectionSchema = collectionBaseSchema.extend({
  id: z.coerce.number().int().positive(),
});

export const newCollectionSchema = collectionBaseSchema;

export const smartRuleSchema = z.object({
  collection_id: z.coerce.number().int().positive(),
  column_name: z.enum(SMART_RULE_COLUMNS),
  relation: z.enum(SMART_RULE_RELATIONS),
  condition: z.string().trim().min(1, 'Condition is required.').max(255),
});

/** Removes one smart rule from a collection. */
export const smartRuleIdSchema = z.object({
  collection_id: z.coerce.number().int().positive(),
  rule_id: z.coerce.number().int().positive(),
});

/** Targets a whole collection (preview / apply rules). */
export const collectionIdSchema = z.object({
  collection_id: z.coerce.number().int().positive(),
});

/** Query params for the admin product picker. */
export const productPickerQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(20),
  status: z.enum(['all', ...PRODUCT_STATUSES]).default('active'),
});

// ─── Blogs and articles ───────────────────────────────────────────────────────

export const blogSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, 'Title is required.').max(255),
  handle: handleSchema,
  tags: tagsSchema,
});

export const newBlogSchema = blogSchema.omit({ id: true });

export const articleSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, 'Title is required.').max(255),
  handle: handleSchema,
  author: z.string().trim().max(255),
  tags: tagsSchema,
  summary_html: htmlSchema,
  body_html: htmlSchema,
  published: checkboxSchema,
});

export const newArticleSchema = articleSchema.omit({ id: true, published: true }).extend({
  blog_id: z.coerce.number().int().positive(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customerSchema = z.object({
  id: z.coerce.number().int().positive(),
  tags: tagsSchema,
  note: z.string().trim().max(5_000),
});

// ─── Orders ───────────────────────────────────────────────────────────────────

// Order ids are Postgres BIGINT. `z.coerce.number()` rounds anything above
// Number.MAX_SAFE_INTEGER, and a rounded id can pass `.eq('id', …)` onto a
// neighboring order — so ids cross the boundary as decimal strings and are
// compared verbatim by PostgREST.
export const bigintOrderIdSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, 'Invalid order id.');

/**
 * Carry a BIGINT id through the typed client. The value stays a decimal
 * string at runtime — PostgREST casts string values to the column type — but
 * the generated database types expect `number`, and actually calling
 * `Number()` would round ids above Number.MAX_SAFE_INTEGER.
 */
export function asBigintId(value: string): number {
  return value as unknown as number;
}

export const orderStatusSchema = z.object({
  order_id: bigintOrderIdSchema,
  // Imported orders can carry statuses outside the allowlist (e.g.
  // `authorized`, `partially_paid`). The status form round-trips such a value
  // as a preserved <option>, so the schema cannot reject it outright — the
  // write action re-checks each status against the allowlist unless it equals
  // the order's persisted value.
  financial_status: z.string().trim().min(1).max(64),
  fulfillment_status: z.string().trim().min(1).max(64),
});

export const fulfillmentSchema = z
  .object({
    order_id: bigintOrderIdSchema,
    tracking_company: z.string().trim().max(255),
    tracking_number: z.string().trim().min(1, 'Tracking number is required.').max(255),
  })
  .refine((v) => !v.tracking_company || v.tracking_number.length > 0, {
    message: 'Tracking number is required when a carrier is set.',
    path: ['tracking_number'],
  });

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryUpdateSchema = z.object({
  variant_id: z.coerce.number().int().positive(),
  inventory_quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative.'),
});

// ─── Discounts ────────────────────────────────────────────────────────────────

export const discountSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(255),
    code: z
      .string()
      .trim()
      .min(1, 'Code is required.')
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dashes, and underscores only.'),
    value: z.coerce.number().positive('Value must be greater than zero.'),
    value_type: z.enum(DISCOUNT_VALUE_TYPES),
    starts_at: z.string().trim(),
    ends_at: z.string().trim(),
  })
  .refine((v) => !v.ends_at || !v.starts_at || v.ends_at > v.starts_at, {
    message: 'End date must be after the start date.',
    path: ['ends_at'],
  });

// ─── Admin users ──────────────────────────────────────────────────────────────

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const adminUserSchema = z.object({
  user_id: z.string().trim().regex(UUID_RE, 'Enter a valid Supabase user UUID.'),
});

export const toggleAdminSchema = adminUserSchema.extend({
  is_active: checkboxSchema,
});

// ─── AI ───────────────────────────────────────────────────────────────────────

export const aiBlogDraftSchema = z.object({
  topic: z.string().trim().min(1, 'Topic is required.').max(500),
  keywords: z.string().trim().max(500).default(''),
});

export const aiBlogSaveSchema = z.object({
  topic: z.string().trim().min(1, 'Topic is required.').max(500),
  summary_html: htmlSchema.default(''),
  body_html: htmlSchema.min(1, 'Body is required.'),
  tags: tagsSchema.default(''),
  citations: z.array(z.string().max(2_000)).max(50).default([]),
});

export const aiMarketingSchema = z.object({
  brief: z.string().trim().min(1, 'Brief is required.').max(4_000),
});

export const aiListingRequestSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

/** Shape returned by `/api/ai/listing`; applied through the same action path. */
export const listingSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body_html: htmlSchema,
  tags: tagsSchema.optional(),
  collections: z.array(z.string().max(255)).max(20).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

export const aiListingApplySchema = z.object({
  productId: z.coerce.number().int().positive(),
  suggestion: listingSuggestionSchema,
});

// ─── Refunds ──────────────────────────────────────────────────────────────────

/**
 * Refund request.
 *
 * An absent/empty amount means "refund the full remaining balance", which
 * `reserve_refund()` resolves against the transaction total.
 *
 * The empty case is normalized in a `preprocess` step rather than a `transform`
 * after a `z.coerce.number()` union: `Number('')` is `0`, so the union matched
 * the coerced number, the transform's `v === ''` branch never ran, and the
 * `> 0` refine rejected it. The refund panel's own hint says "leave empty for
 * full", so the documented full-refund path was unreachable.
 */
export const refundSchema = z.object({
  orderId: bigintOrderIdSchema,
  transactionId: z.coerce.number().int().positive(),
  amount: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().positive('amount must be a positive number').optional(),
  ),
});
