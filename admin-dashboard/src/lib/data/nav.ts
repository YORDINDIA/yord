import 'server-only';

import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { reader, runCount } from './client';

/**
 * Sidebar badge counts.
 *
 * Two head-only counts, in parallel, through the same `reader()` + `runCount()`
 * pair every other read uses. The predicates match `getDashboardSummary()` on
 * purpose — the KPI cards and the sidebar badge must never disagree — including
 * the NULL arms: migrated orders carry NULL instead of 'unfulfilled', and a NULL
 * inventory quantity means "unknown stock", which the inventory UI renders as
 * low.
 *
 * A failed read throws (`runCount` → `fail`), never a zero. `(admin)/layout.tsx`
 * is the single place that degrades around that, because this is chrome rather
 * than page data; the data layer keeps the "never report a failure as empty"
 * contract.
 */

export interface NavBadges {
  /** Orders awaiting fulfillment (`unfulfilled`, or migrated NULL). */
  fulfillmentQueue: number;
  /** Variants at or below `LOW_STOCK_THRESHOLD`, including unknown (NULL) stock. */
  lowStock: number;
}

export async function getNavBadges(): Promise<NavBadges> {
  const supabase = await reader();

  const [fulfillmentQueue, lowStock] = await Promise.all([
    runCount(
      'orders',
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .or('fulfillment_status.eq.unfulfilled,fulfillment_status.is.null'),
    ),
    runCount(
      'product_variants',
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .or(`inventory_quantity.lte.${LOW_STOCK_THRESHOLD},inventory_quantity.is.null`),
    ),
  ]);

  return { fulfillmentQueue, lowStock };
}
