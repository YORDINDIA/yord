import type { Metadata } from 'next';
import { listProductOptions } from '@/lib/data/products';
import AiListingStudio from '@/components/ai/AiListingStudio';

export const metadata: Metadata = { title: 'AI Listing · YORD Admin' };

/**
 * AI listing studio.
 *
 * The page previously read products and the cover image from the browser with
 * the anon client, and wrote `product_images.supabase_url` from the browser too
 * — a mutation that bypassed `requireAdmin()` and left no audit record. Reads
 * now come from the server and the write from `applyAiImageAction`.
 *
 * The cover image is looked up per selection in the client via `/api/ai/listing`
 * rather than prefetched here, because it depends on which product is chosen.
 */
export default async function AiListingPage() {
  const products = await listProductOptions(undefined, 200);
  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Improve Listing</div>
            <div className="helper">Generate better copy and tags. Approve to apply.</div>
          </div>
        </div>
        <AiListingStudio products={products} />
      </div>
    </div>
  );
}
