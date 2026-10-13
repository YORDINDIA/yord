import type { Metadata } from 'next';
import { formatDate } from '@yord/ui';
import { OrderConfirmation } from '@/features/checkout/OrderConfirmation';
import {
  estimatedDeliveryWindow,
  isYordOrderName,
  orderNameEpochSeconds,
} from '@/features/checkout/order';
import { Container } from '@/features/ui/Container';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { ProductCard } from '@/features/ui/ProductCard';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { degrade } from '@/lib/result';
import { getProductsFiltered } from '@/lib/supabase/queries';

export const metadata: Metadata = {
  title: 'Order Confirmed',
  description: 'Your YORD India order is confirmed.',
  // A per-order URL must never sit in an index.
  robots: { index: false, follow: false },
  alternates: { canonical: '/checkout/success' },
};

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ order_name?: string }>;
}

/**
 * Confirmation screen.
 *
 * Only a YORD order name from a real checkout counts as a confirmation — it is
 * what `/track-order` looks up. The pattern is shared with whatever mints it
 * (`features/checkout/order.ts`), rather than a second private copy here.
 * Direct visits get a neutral "no recent order" state.
 *
 * The delivery window is computed here, from the timestamp embedded in the
 * order name, and passed down as formatted strings: formatting a live `Date`
 * in a client component would differ between the server render and hydration.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { order_name } = await searchParams;
  const orderName = isYordOrderName(order_name) ? order_name : null;

  if (!orderName) {
    return (
      <div className="min-h-screen bg-surface-page pt-24 pb-16">
        <Container size="narrow">
          <div className="mx-auto max-w-2xl">
            <EmptyState
              title="No recent order"
              message="We could not find a completed checkout. Your bag is waiting if you left items behind."
            >
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <CtaLink href="/" variant="primary" size="lg">
                  CONTINUE SHOPPING
                </CtaLink>
                <CtaLink href="/account/orders" variant="secondary" size="lg">
                  VIEW ORDER STATUS
                </CtaLink>
              </div>
            </EmptyState>
          </div>
        </Container>
      </div>
    );
  }

  const epochSeconds = orderNameEpochSeconds(orderName);
  const orderedAt = epochSeconds ? new Date(epochSeconds * 1000) : new Date();
  const { start, end } = estimatedDeliveryWindow(orderedAt);

  // Cross-sell is an optional section: a failed read hides the rail instead of
  // throwing the confirmation into the error boundary.
  const recommendations = await degrade(
    getProductsFiltered({ pageSize: 4, sortBy: 'newest' }),
    { data: [], count: 0 },
    'checkout-success:cross-sell',
    'products'
  );
  const products = recommendations.ok ? recommendations.value.data : [];

  return (
    <div className="min-h-screen bg-surface-page pt-24 pb-16">
      <Container>
        <OrderConfirmation
          orderName={orderName}
          etaStart={formatDate(start.toISOString())}
          etaEnd={formatDate(end.toISOString())}
        />

        {/* Cross-sell. Optional section: a failed read hides the rail instead
            of throwing a confirmed order into the error boundary. It sits
            outside the confirmation's narrow column so the cards keep their
            size. */}
        {products.length > 0 && (
          <section aria-labelledby="more-from-yord" className="mt-20">
            <SectionHeading
              id="more-from-yord"
              as="h2"
              eyebrow="Keep the momentum"
              title="More from the drop"
              align="center"
            />
            <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </div>
  );
}
