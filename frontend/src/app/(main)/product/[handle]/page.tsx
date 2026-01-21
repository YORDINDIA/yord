import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductInfo } from '@/components/product/ProductInfo';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { getProductByHandle } from '@/lib/supabase/queries';
import { ARTISTS } from '@/types/database';

interface ProductPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    return {
      title: 'Product Not Found | YORD India',
    };
  }

  return {
    title: `${product.title} | YORD India`,
    description: `Shop ${product.title} from ${product.vendor || 'YORD'}. Premium artist-inspired fan merchandise.`,
    openGraph: {
      title: `${product.title} | YORD India`,
      description: `Shop ${product.title} from ${product.vendor || 'YORD'}. Premium concert merchandise.`,
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params;
  const productData = await getProductByHandle(handle);

  if (!productData) {
    notFound();
  }

  // Get artist accent color
  const artistHandle = productData.vendor?.toLowerCase().replace(/\s+/g, '-') || '';
  const artistData = ARTISTS[artistHandle];
  const accentColor = artistData?.accentColor || '#FFD966';

  // Transform Supabase data to match component expectations
  const product = {
    id: productData.id,
    handle: productData.handle,
    title: productData.title,
    vendor: productData.vendor || '',
    description: productData.body_html || '',
    images: productData.product_images?.map((img) => ({
      id: img.id,
      src: img.supabase_url || img.src,
      alt: img.alt || productData.title,
      position: img.position,
    })) || [],
    variants: productData.product_variants?.map((v) => ({
      id: v.id,
      title: v.title || v.option1 || 'Default',
      price: v.price,
      compareAtPrice: v.compare_at_price,
      inventoryQuantity: v.inventory_quantity,
      option1: v.option1 || 'Default',
    })).sort((a, b) => a.id - b.id) || [],
    options: productData.product_options?.map((opt) => ({
      name: opt.name,
      values: opt.values || [],
    })) || [],
    tags: productData.tags || '',
    accentColor,
  };

  return (
    <main className="min-h-screen bg-noir-950 pt-20">
      {/* Product Section */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Gallery */}
          <ProductGallery
            images={product.images}
            title={product.title}
            accentColor={product.accentColor}
          />

          {/* Product Info */}
          <ProductInfo
            product={product}
          />
        </div>
      </section>

      {/* Related Products */}
      <RelatedProducts
        currentProductId={product.id}
        vendor={product.vendor}
        accentColor={product.accentColor}
      />
    </main>
  );
}
