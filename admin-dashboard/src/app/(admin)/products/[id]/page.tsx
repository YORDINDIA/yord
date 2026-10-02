import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Package } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import ProductEditor from '@/components/products/ProductEditor';
import VariantEditor from '@/components/products/VariantEditor';
import ImageGrid from '@/components/products/ImageGrid';
import AddImageForm from '@/components/products/AddImageForm';
import ProductPreviewCard from '@/components/products/ProductPreviewCard';
import ProductStockCard from '@/components/products/ProductStockCard';
import ProductMetaCard from '@/components/products/ProductMetaCard';
import { getProduct, listProductCollections } from '@/lib/data/products';
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
 * from a successful one. The reads now go through `getProduct()` and
 * `listProductCollections()`, the writes through the actions in
 * `src/server/actions/products.ts`, which return `ActionState` and audit every
 * committed change.
 *
 * Layout: `PageHeader` for identity and status, then `.layout-split` — the
 * editor/variant/image column on the left, a sticky rail on the right with the
 * storefront preview, the stock summary, and the product's provenance.
 */
export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const detail = await getProduct(numericId);
  if (!detail) notFound();

  const { product, variants, images } = detail;
  const collections = await listProductCollections(numericId);

  const firstVariant = variants[0];
  const cover = images[0];

  return (
    <>
      <PageHeader
        icon={Package}
        tone="indigo"
        title={product.title}
        description={`Product #${product.id} · updated ${formatDate(product.updated_at)}`}
        actions={
          <>
            <StatusBadge value={product.status} size="md" />
            <Link className="button" href="/products">
              <ArrowLeft size={14} aria-hidden />
              Back to catalog
            </Link>
          </>
        }
      />

      <div className="layout-split">
        <div className="stack">
          <section className="card">
            <div className="card-header">
              <div className="section-title">Product</div>
              <span className="helper">Title, handle, status, tags, and the description.</span>
            </div>
            <ProductEditor product={product} />
          </section>

          <section className="card">
            <div className="card-header">
              <div className="section-title">Variants</div>
              <span className="helper">
                Edit any row, then save once. Saving is atomic; only changed rows are sent.
              </span>
            </div>
            <VariantEditor variants={variants} productId={product.id} />
          </section>

          <section className="card">
            <div className="card-header">
              <div className="section-title">Images</div>
              <span className="helper">
                The first image is the cover. Hover a tile for actions, click it to preview.
              </span>
            </div>
            <ImageGrid images={images} />
            <AddImageForm productId={product.id} />
          </section>
        </div>

        <aside className="side-rail">
          <ProductPreviewCard
            product={product}
            imageUrl={cover ? cover.storage_url ?? cover.src : null}
            price={Number(firstVariant?.price ?? 0)}
            compareAtPrice={firstVariant?.compare_at_price ?? null}
          />
          <ProductStockCard variants={variants} />
          <ProductMetaCard product={product} collections={collections} />
        </aside>
      </div>
    </>
  );
}
