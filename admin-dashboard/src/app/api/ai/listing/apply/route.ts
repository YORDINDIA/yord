export const runtime = 'nodejs';

import { requireAdmin } from '@/lib/utils/admin';
import { failJson, okJson } from '@/lib/utils/prompt';
import { applyListingSuggestionAction } from '@/server/actions/products';

/**
 * Apply an AI listing suggestion to a product.
 *
 * The route wrote `body_html` straight from the model response into a column the
 * storefront renders with `dangerouslySetInnerHTML`, with no sanitization and no
 * shared schema. It now delegates to `applyListingSuggestionAction`, which
 * sanitizes the HTML, validates through `aiListingApplySchema`, and audits the
 * before/after pair through the same `audit()` helper as every other product
 * write.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return failJson('BAD_REQUEST', 'Request body must be JSON', 400);
  }

  const body = payload as { productId?: unknown; suggestion?: unknown };
  // `req.json()` accepts any valid JSON, including `null` and arrays. Reading
  // fields off those throws inside the framework handler (a 500); reject them
  // as client errors instead.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return failJson('BAD_REQUEST', 'Request body must be a JSON object', 400);
  }
  const suggestion =
    typeof body.suggestion === 'object' && body.suggestion !== null && !Array.isArray(body.suggestion)
      ? (body.suggestion as { title?: unknown; body_html?: unknown; tags?: unknown })
      : undefined;

  const result = await applyListingSuggestionAction({
    productId: Number(body.productId),
    // Pass values through untouched so malformed input fails schema validation.
    // The old `String(...)` coercion turned an object title into
    // `"[object Object]"`, which passed the schema and overwrote the listing.
    suggestion: {
      title: suggestion?.title,
      body_html: suggestion?.body_html,
      tags: suggestion?.tags,
    } as { title: string; body_html: string; tags?: string },
  });

  if (result.status === 'error') {
    return failJson('BAD_REQUEST', result.formError ?? 'Failed to apply the suggestion.', 400);
  }
  return okJson({ productId: result.data?.productId ?? null }, { success: true });
}
