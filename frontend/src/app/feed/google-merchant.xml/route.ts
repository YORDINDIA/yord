/**
 * Google Merchant Center feed — scheduled fetch source.
 *
 * URL: https://yordindia.com/feed/google-merchant.xml
 * (Not under `/api/`, which `robots.ts` disallows; Google's fetchers must be
 * able to reach it.)
 *
 * Failure policy: a read error returns 500, never a partial feed. GMC treats
 * absent items as deletions — half a document would wipe the missing half of
 * the catalog from Shopping, which is worse than a failed fetch.
 */
import { createStaticClient } from '@/lib/supabase/server';
import { isSupabaseUnconfigured } from '@/lib/result';
import { logDbError, logInfo, logWarn } from '@/lib/logger';
import {
  buildMerchantFeed,
  type MerchantFeedProduct,
} from '@/lib/feed/google-merchant';

// Dynamic on purpose: the route reads Supabase at request time and caches on
// the CDN via the response header, so a build (or CI, with mock env values)
// never needs a live database.
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://yordindia.com';

/** Products per page; Supabase caps a response at 1000 rows. */
const PAGE_SIZE = 200;

/** Safety valve — the catalog is ~460 products; 5000 leaves room to grow. */
const MAX_PRODUCTS = 5000;

const PRODUCT_SELECT =
  'id, handle, title, body_html, meta_description, product_type, vendor, ' +
  'product_variants ( id, title, option1, price, sku, barcode, inventory_quantity ), ' +
  'product_images ( src, storage_url, position )';

async function readActiveProducts(): Promise<MerchantFeedProduct[]> {
  const supabase = createStaticClient();
  const products: MerchantFeedProduct[] = [];

  for (let from = 0; from < MAX_PRODUCTS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'active')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (data ?? []) as unknown as MerchantFeedProduct[];
    products.push(...rows);
    if (rows.length < PAGE_SIZE) return products;
  }

  logWarn('merchant-feed', 'TRUNCATED', `stopped at ${MAX_PRODUCTS} products`);
  return products;
}

export async function GET() {
  if (isSupabaseUnconfigured()) {
    // 503, not an empty feed: an empty document would read as "delete every
    // product" if a misconfigured deploy were ever reachable.
    return new Response('Feed unavailable: backend not configured', { status: 503 });
  }

  try {
    const products = await readActiveProducts();
    const { xml, itemCount, skipped } = buildMerchantFeed(products, {
      baseUrl: BASE_URL,
      mediaBaseUrl: process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
    });

    if (skipped > 0) {
      // Not fatal: those products can't be listed (no image / no priced
      // variant) and GMC would disapprove them. Tracked so the gap is visible.
      logWarn('merchant-feed', 'SKIPPED', `${skipped} products omitted from ${products.length}`);
    }
    logInfo('merchant-feed', 'WRITTEN', `${itemCount} items`);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // CDN cache: GMC fetches once a day; an hour of freshness is plenty.
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    logDbError('merchant-feed', error);
    return new Response('Feed read failed', { status: 500 });
  }
}
