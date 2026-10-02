import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import AiListingStudio from '@/components/ai/AiListingStudio';
import type { ProductOption } from '@/components/ai/ProductPicker';
import PageHeader from '@/components/ui/PageHeader';
import { listProducts } from '@/lib/data/products';

export const metadata: Metadata = { title: 'AI Listing · YORD Admin' };

/**
 * AI listing studio.
 *
 * The page previously read products and the cover image from the browser with
 * the anon client, and wrote `product_images.storage_url` from the browser too
 * — a mutation that bypassed `requireAdmin()` and left no audit record. Reads
 * now come from the server and the write from `applyAiImageAction`.
 *
 * The first page of the catalog is rendered here so the picker opens with real
 * products (title, handle, price, cover) instead of a capped `<select>`; the
 * full catalog is reachable through the picker's own search. The cover image for
 * the *chosen* product still comes from `GET /api/ai/listing`, because it
 * depends on which product is selected.
 */
export default async function AiListingPage() {
  // A failed read throws `DatabaseError` and renders the route's error boundary,
  // so an empty picker below always means an empty catalog.
  const { rows } = await listProducts({ page: 1, pageSize: 25, sort: 'updated_at' });
  const products: ProductOption[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    handle: row.handle,
    price: row.price,
    imageUrl: row.imageUrl,
  }));

  return (
    <>
      <PageHeader
        icon={FileText}
        title="AI listing"
        description="Rewrite one product's title, description and tags, and regenerate its cover — review before applying."
      />
      <AiListingStudio products={products} />
    </>
  );
}
