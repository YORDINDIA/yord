import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

/**
 * ISR/data cache for the storefront. Catalog, artist, product, collection and
 * concert pages export `revalidate = 3600`, so the R2 incremental cache turns
 * every HTML request from a full re-render (the default dummy cache always
 * reports `x-nextjs-cache: MISS`) into an edge-served HIT, with a per-region
 * Cache API layer in front of R2 for latency. The DO queue dedupes background
 * revalidations. No tag cache: the storefront never calls revalidateTag or
 * revalidatePath, so entries expire by time through the incremental cache
 * alone. See https://opennext.js.org/cloudflare/caching
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  queue: doQueue,
  // Serves cached ISR routes without booting the NextServer at all. Not
  // compatible with PPR, which this app does not use.
  enableCacheInterception: true,
});
