'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/ui/ProductCard';
import { createClient } from '@/lib/supabase/client';
import { escapeLike, getFirstByPosition, getProductBadge } from '@/lib/utils';
import { vendorToHandle } from '@/types/database';
import type { ProductWithDetails } from '@/types/database';

interface RelatedProductsProps {
  currentProductId: number;
  vendor: string;
  accentColor?: string;
}

interface SimpleProduct {
  id: number;
  handle: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  badge: 'NEW' | 'SALE' | 'LIMITED' | 'BESTSELLER' | 'TRENDING' | null;
  variantId: number | null;
  variantTitle: string | null;
  maxQuantity: number;
}

export function RelatedProducts({ currentProductId, vendor, accentColor = '#FFD966' }: RelatedProductsProps) {
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRelatedProducts() {
      // Vendor-less products have no "more from" set; skip instead of match-all (%%)
      if (!vendor.trim()) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const { data, error } = await supabase
        .from('products')
        .select(`
          id, title, handle, published_at,
          product_variants (id, title, price, compare_at_price, inventory_quantity, position),
          product_images (id, src, supabase_url, position)
        `)
        .eq('status', 'active')
        .neq('id', currentProductId)
        .ilike('vendor', `%${escapeLike(vendor)}%`)
        .order('published_at', { ascending: false })
        .limit(4);

      if (error || !data) {
        setLoading(false);
        return;
      }

      const transformedProducts: SimpleProduct[] = (data as ProductWithDetails[]).map((p) => {
        const variant = getFirstByPosition(p.product_variants);
        const image = getFirstByPosition(p.product_images);

        return {
          id: p.id,
          handle: p.handle,
          title: p.title,
          price: variant?.price || 0,
          compareAtPrice: variant?.compare_at_price || null,
          image: image?.supabase_url || image?.src || null,
          badge: getProductBadge(p, variant),
          variantId: variant?.id ?? null,
          variantTitle: variant?.title ?? null,
          maxQuantity: variant && variant.inventory_quantity > 0 ? variant.inventory_quantity : 10,
        };
      });

      setProducts(transformedProducts);
      setLoading(false);
    }

    fetchRelatedProducts();
  }, [currentProductId, vendor]);

  if (loading) {
    return (
      <section className="py-24 bg-noir-900">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="animate-pulse">
            <div className="h-4 w-32 bg-noir-800 mb-3" />
            <div className="h-8 w-64 bg-noir-800 mb-12" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className="aspect-[3/4] bg-noir-800 mb-4" />
                  <div className="h-4 bg-noir-800 mb-2 w-1/3" />
                  <div className="h-5 bg-noir-800 mb-2" />
                  <div className="h-4 bg-noir-800 w-1/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-24 bg-noir-900">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <p
              className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] mb-3"
              style={{ color: accentColor }}
            >
              MORE FROM {vendor.toUpperCase()}
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50">
              You May Also Like
            </h2>
          </div>
          <Link
            href={`/artist/${vendorToHandle(vendor)}`}
            className="hidden sm:flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-100 hover:text-gold-200 transition-colors group"
          >
            VIEW ALL
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <ProductCard
                handle={product.handle}
                title={product.title}
                artist={vendor}
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                image={product.image}
                badge={product.badge}
                accentColor={accentColor}
                productId={product.id}
                variantId={product.variantId}
                variantTitle={product.variantTitle}
                maxQuantity={product.maxQuantity}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
