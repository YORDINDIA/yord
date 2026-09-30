import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductEditor from '@/components/products/ProductEditor';
import VariantEditor from '@/components/products/VariantEditor';
import ImageGrid from '@/components/products/ImageGrid';
import AddImageForm from '@/components/products/AddImageForm';
import StatusBadge from '@/components/ui/StatusBadge';
import { getProduct } from '@/lib/data/products';
import { formatDate } from '@/lib/utils/format';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getProduct(Number(id)).catch(() => null);
  return { title: detail ? `${detail.product.title} · YORD Admin` : 'Product · YORD Admin' };
}

/**
 * Product detail.
 *
 * This file used to hold six inline `'use server'` mutations, each of which
 * returned `undefined` on any failure, so a rejected save was indistinguishable
 * from a successful one. The reads now go through `getProduct()` and the writes
 * through the actions in `src/server/actions/products.ts`, which return
 * `ActionState` and audit every committed change.
 */
export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const detail = await getProduct(numericId);
  if (!detail) notFound();

  const { product, variants, images } = detail;

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Product Detail</div>
            <div className="helper">
              Last updated {formatDate(product.updated_at)} · <StatusBadge value={product.status} />
            </div>
          </div>
          <Link className="button" href="/products">
            Back
          </Link>
        </div>
        <ProductEditor product={product} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Variants</div>
            <div className="helper">Edit all rows, then save once. Saving is atomic.</div>
          </div>
        </div>
        <VariantEditor variants={variants} productId={product.id} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Images</div>
            <div className="helper">
              The first image is the cover. Hover an image for copy, set-cover, and delete.
            </div>
          </div>
        </div>
        <ImageGrid images={images} />
        <AddImageForm productId={product.id} />
      </div>
    </div>
  );
}
