import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { ProductGallery } from '@/features/product/ProductGallery';
import { ProductInfo } from '@/features/product/ProductInfo';
import { ProductDescription } from '@/features/product/ProductDescription';
import { ProductViewTracker } from '@/features/product/ProductViewTracker';
import { RelatedProducts } from '@/features/product/RelatedProducts';
import { Container } from '@/features/ui/Container';
import { getProductByHandleStatic } from '@/lib/supabase/queries';
import { createStaticClient } from '@/lib/supabase/server';
import { sortByPosition } from '@/lib/product';
import { ARTISTS } from '@yord/db-types';
import { stripHtml } from '@yord/ui';
import { JsonLd, productSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface ProductPageProps {
  params: Promise<{ handle: string }>;
}

export const revalidate = 3600;

export async function generateStaticParams() {
  // Build-time enumeration degrades to [] so a catalog hiccup or missing env
  // during the build does not fail it; unlisted handles render on demand.
  try {
    const supabase = createStaticClient();
    const { data: products, error } = await supabase
      .from('products')
      .select('handle')
      .eq('status', 'active');
    if (error) return [];

    return (products || [])
      .filter((p): p is { handle: string } => p.handle != null)
      .map((p) => ({
        handle: p.handle,
      }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandleStatic(handle);

  if (!product) {
    return { title: 'Product Not Found' };
  }

  const price = product.product_variants?.[0]?.price;
  const image = product.product_images?.[0];
  const imageUrl = image?.storage_url || image?.src;
  // Enriched SEO columns win when present (005_seo_content.sql); otherwise
  // fall back to the pre-enrichment title/body slicing.
  const description = product.meta_description
    ?? (product.body_html
      ? stripHtml(product.body_html).slice(0, 160)
      : `Shop ${product.title} from ${product.vendor || 'YORD India'}. Premium concert merchandise. Buy online with free shipping on every order.`);

  return {
    title: product.meta_title
      ?? `${product.title} — ${product.vendor || 'YORD India'} Concert Merchandise`,
    description,
    keywords: product.search_keywords
      ? product.search_keywords.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined,
    openGraph: {
      title: `${product.title} | YORD India`,
      description,
      type: 'website',
      images: imageUrl ? [{ url: imageUrl, alt: product.title }] : undefined,
    },
    alternates: {
      canonical: `/product/${handle}`,
    },
    other: price
      ? {
        'product:price:amount': price.toString(),
        'product:price:currency': 'INR',
      }
      : undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params;
  // Static (cookie-free) client so `revalidate = 3600` actually applies; the
  // cookie-based variant forced dynamic rendering.
  const productData = await getProductByHandleStatic(handle);

  if (!productData) {
    notFound();
  }

  // Get artist accent color
  const artistHandle = productData.vendor?.toLowerCase().replace(/\s+/g, '-') || '';
  const artistData = ARTISTS[artistHandle];
  const accentColor = artistData?.accentColor || 'var(--accent)';

  // Transform Supabase data to match component expectations
  const product = {
    id: productData.id,
    handle: productData.handle ?? handle,
    title: productData.title,
    vendor: productData.vendor || '',
    description: productData.body_html || '',
    images: productData.product_images?.map((img) => ({
      id: img.id,
      src: img.storage_url || img.src,
      alt: img.alt || productData.title,
      position: img.position,
    })) || [],
    // `position` order, matching the gallery and the quick view. Sorting by id
    // put the same product's sizes in a different order on the PDP than in the
    // grid's quick view.
    variants: sortByPosition(productData.product_variants).map((v) => ({
      id: v.id,
      title: v.title || v.option1 || 'Default',
      price: v.price,
      compareAtPrice: v.compare_at_price,
      inventoryQuantity: v.inventory_quantity,
      option1: v.option1 || 'Default',
      position: v.position,
    })),
    options: productData.product_options?.map((opt) => ({
      name: opt.name,
      values: opt.values || [],
    })) || [],
    tags: productData.tags || '',
    accentColor,
  };

  return (
    <div className="bg-surface-page pt-20">
      <ProductViewTracker productId={product.id} handle={product.handle} />
      <JsonLd data={productSchema(productData)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
          { name: product.title, url: `/product/${productData.handle}` },
        ])}
      />
      {/* Visible breadcrumb: the hierarchy existed only in the JSON-LD, so the
          page itself offered no way back up to /products. */}
      <Container className="pt-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 font-body text-xs text-text-muted">
            <li>
              <Link href="/" className="hover:text-accent transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href="/products" className="hover:text-accent transition-colors">
                Products
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li aria-current="page" className="text-text-secondary truncate max-w-[18rem]">
              {product.title}
            </li>
          </ol>
        </nav>
      </Container>

      {/* Product Section — the info column is the sticky rail, so price and
          add-to-bag stay reachable while the gallery scrolls. */}
      <Container as="section" className="py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Gallery */}
          <ProductGallery
            images={product.images}
            title={product.title}
            accentColor={product.accentColor}
          />

          {/* Product Info */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductInfo
              key={product.id}
              product={{
                ...product,
                image: product.images[0]?.src || null,
              }}
            />
          </div>
        </div>
      </Container>

      {/* Description — full width below the fold, so the sticky rail stays
          short enough to actually stick. */}
      <Container size="narrow" className="pb-16">
        <ProductDescription html={product.description} />
      </Container>

      {/* Related Products */}
      <RelatedProducts
        currentProductId={product.id}
        vendor={product.vendor}
        accentColor={product.accentColor}
      />
    </div>
  );
}
