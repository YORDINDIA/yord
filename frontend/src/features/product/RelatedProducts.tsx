'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/features/ui/ProductCard';
import { Container } from '@/features/ui/Container';
import { ErrorState } from '@/features/ui/ErrorState';
import { Reveal } from '@/features/ui/Reveal';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { Skeleton } from '@/features/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { getFirstByPosition, getProductBadge, sortByPosition } from '@/lib/product';
import { escapeLike } from '@/lib/search';
import { vendorToHandle } from '@yord/db-types';
import type { ProductWithDetails } from '@yord/db-types';
import { maxQuantityFor } from './cartItem';

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

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; products: SimpleProduct[] }
  | { status: 'error' };

/**
 * "More from this artist" rail.
 *
 * Three states, kept distinct: loading (skeleton), empty (render nothing — an
 * optional section, not an error) and failed (an error state with its own
 * retry). The failed read used to fall into the empty path and silently vanish.
 */
export function RelatedProducts({ currentProductId, vendor, accentColor = 'var(--accent)' }: RelatedProductsProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  /** Resolves to the rail's products, or `null` when the read failed. */
  const fetchRelated = useCallback(async (): Promise<SimpleProduct[] | null> => {
    // Vendor-less products have no "more from" set; skip instead of match-all (%%)
    if (!vendor.trim()) return [];

    const supabase = createClient();

    const { data, error } = await supabase
      .from('products')
      .select(`
        id, title, handle, published_at,
        product_variants (id, title, price, compare_at_price, inventory_quantity, position),
        product_images (id, src, storage_url, position)
      `)
      .eq('status', 'active')
      .neq('id', currentProductId)
      .ilike('vendor', `%${escapeLike(vendor)}%`)
      .order('published_at', { ascending: false })
      .limit(4);

    if (error || !data) return null;

    return (data as unknown as ProductWithDetails[])
      // A null handle becomes an empty string and a broken /product/ link.
      .filter((p) => p.handle)
      .map((p) => {
        const variants = sortByPosition(p.product_variants);
        const variant =
          variants.find((candidate) => candidate.inventory_quantity > 0) ??
          getFirstByPosition(p.product_variants);
        const image = getFirstByPosition(p.product_images);

        return {
          id: p.id,
          handle: p.handle ?? '',
          title: p.title,
          price: variant?.price || 0,
          compareAtPrice: variant?.compare_at_price || null,
          image: image?.storage_url || image?.src || null,
          badge: getProductBadge(p, variant),
          variantId: variant?.id ?? null,
          variantTitle: variant?.title ?? null,
          maxQuantity: maxQuantityFor(variant?.inventory_quantity),
        };
      });
  }, [currentProductId, vendor]);

  const applyResult = useCallback((products: SimpleProduct[] | null) => {
    setState(products === null ? { status: 'error' } : { status: 'ready', products });
  }, []);

  // The result lands in a promise callback rather than synchronously in the
  // effect body (a cascading render), and a product change cancels the in-flight
  // response so a slow rail cannot overwrite the new product's.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const products = await fetchRelated();
      if (!cancelled) applyResult(products);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchRelated, applyResult]);

  const retry = useCallback(async () => {
    setState({ status: 'loading' });
    applyResult(await fetchRelated());
  }, [fetchRelated, applyResult]);

  if (state.status === 'loading') {
    return (
      <section className="py-24 bg-surface-card">
        <Container>
          <Skeleton variant="text-block" className="mb-12 max-w-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="product-card" />
            ))}
          </div>
        </Container>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="py-24 bg-surface-card">
        <Container>
          <ErrorState
            as="h2"
            title="Could not load more products"
            message="Check your connection and try again."
            onRetry={retry}
            retryLabel="Retry"
            showHomeLink={false}
          />
        </Container>
      </section>
    );
  }

  if (state.products.length === 0) return null;

  return (
    <section className="py-24 bg-surface-card">
      <Container>
        <Reveal className="mb-12">
          <SectionHeading
            eyebrow={`MORE FROM ${vendor.toUpperCase()}`}
            title="You May Also Like"
            action={
              <Link
                href={`/artist/${vendorToHandle(vendor)}`}
                className="hidden sm:flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-text-secondary hover:text-accent transition-colors group"
              >
                VIEW ALL
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            }
          />
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {state.products.map((product, index) => (
            <Reveal key={product.id} delay={index * 0.1}>
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
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
