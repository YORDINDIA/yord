'use client';

import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import { CheckCircle, Package, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@yord/ui';
import { CtaLink } from '@/features/ui/CtaLink';
import {
  getLastOrderSnapshot,
  subscribeToLastOrder,
  type StoredOrder,
} from './order';

interface OrderConfirmationProps {
  orderName: string;
  /** Formatted on the server, from the order's own timestamp. */
  etaStart: string;
  etaEnd: string;
}

/**
 * The confirmation screen — the last thing a shopper sees in the funnel, and
 * the one place a return visit starts.
 *
 * It used to show the order number and nothing else: no items, no total, no
 * address, no delivery date. The payload written at checkout was never read by
 * anything. It is read here (same tab, same order only), and the delivery
 * window is derived from the order name's timestamp so it survives a reload
 * that clears `sessionStorage`.
 */
export function OrderConfirmation({
  orderName,
  etaStart,
  etaEnd,
}: OrderConfirmationProps) {
  // `sessionStorage` is client-only, and the server renders this component
  // too. `useSyncExternalStore` reads it through the server snapshot during
  // SSR and hydration and through the real payload afterwards — so the two
  // trees agree, no state is set from an effect, and the order number and ETA
  // (from props) are on screen before the payload lands.
  const stored = useSyncExternalStore(
    subscribeToLastOrder,
    getLastOrderSnapshot,
    () => null
  );
  const order: StoredOrder | null =
    stored && stored.orderName === orderName ? stored : null;

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL;
  const shareText = `Just ordered from YORD India — concert fashion and fan-made merch.${siteUrl ? ` ${siteUrl}` : ''}`;
  const shareLinks = [
    {
      label: 'Share on WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
    },
    {
      label: 'Share on X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl text-center">
      {/* Success Icon */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-success" aria-hidden="true" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl text-text-primary mb-4">
          Order Confirmed
        </h1>
        <p className="font-body text-text-muted text-lg">
          Thank you for shopping with YORD India
        </p>
      </div>

      {/* Order Number */}
      <div className="bg-surface-card border border-border-default p-6 md:p-8 mb-8">
        <p className="font-body text-xs uppercase tracking-wider text-text-muted mb-1">
          Order number
        </p>
        <p className="font-accent text-2xl text-accent tracking-wider break-all">
          {orderName}
        </p>
        <p className="mt-3 font-body text-xs text-text-muted">
          Keep this for tracking and support.
        </p>
      </div>

      {/* Delivery estimate, anchored to the order's own timestamp */}
      <div className="flex items-start gap-4 p-4 bg-surface-card border border-border-default mb-8 text-left">
        <Package className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-body text-sm text-text-secondary font-medium">
            Estimated delivery
          </p>
          <p className="font-body text-sm text-text-primary mt-1">
            {etaStart} &ndash; {etaEnd}
          </p>
          <p className="font-body text-xs text-text-muted mt-1">
            You&apos;ll receive SMS and email updates as your order ships.
          </p>
        </div>
      </div>

      {/* Items and totals, when this tab still holds the checkout payload */}
      {order && (
        <section aria-labelledby="order-details-heading" className="mb-8 text-left">
          <h2 id="order-details-heading" className="sr-only">
            Order details
          </h2>
          <div className="bg-surface-card border border-border-default">
            <ul className="divide-y divide-border-default">
              {order.items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="p-4 flex gap-4">
                  <div className="relative w-16 h-20 flex-shrink-0 bg-surface-raised">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-text-muted" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-sm text-text-secondary line-clamp-2">
                      {item.title}
                    </p>
                    {item.variantTitle && item.variantTitle !== 'Default Title' && (
                      <p className="font-body text-xs text-text-muted mt-1">
                        Size: {item.variantTitle}
                      </p>
                    )}
                    <p className="font-body text-xs text-text-muted mt-1">
                      Qty {item.quantity}
                    </p>
                  </div>
                  <p className="font-body text-sm text-text-secondary">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="border-t border-border-default p-4 space-y-2 font-body text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Subtotal</dt>
                <dd className="text-text-secondary">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-border-default">
                <dt className="font-display text-base text-text-primary">Total paid</dt>
                <dd className="font-display text-base text-accent">{formatPrice(order.total)}</dd>
              </div>
            </dl>
            {/* GST is contained in the inclusive price, not added to it.
                Outside the <dl>: a bare <p> is not valid dt/dd/div content. */}
            <p className="px-4 pb-4 font-body text-xs text-text-muted">
              Inclusive of all taxes (GST {formatPrice(order.gst)})
            </p>

            <div className="border-t border-border-default p-4">
              <p className="font-body text-xs uppercase tracking-wider text-text-muted mb-2">
                Delivering to
              </p>
              <address className="not-italic font-body text-sm text-text-secondary">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                <br />
                {order.shippingAddress.address1}
                {order.shippingAddress.address2 ? `, ${order.shippingAddress.address2}` : ''}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.pincode}
                <br />
                {order.shippingAddress.phone}
              </address>
            </div>
          </div>
        </section>
      )}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <CtaLink href="/" variant="gold" size="lg">
          CONTINUE SHOPPING
        </CtaLink>
        <CtaLink href="/account/orders" variant="secondary" size="lg">
          VIEW ORDER STATUS
        </CtaLink>
      </div>

      {/* Share. These were three focusable buttons with no handler, no href and
          no accessible name — pressable and inert. They are real share links
          now; Instagram is gone because it has no web share intent for text. */}
      <div className="mt-12 pt-8 border-t border-border-default">
        <p className="font-body text-sm text-text-muted mb-4">
          Share your excitement with friends
        </p>
        <div className="flex justify-center gap-4">
          {shareLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="w-11 h-11 flex items-center justify-center bg-surface-raised text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d={link.path} />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
