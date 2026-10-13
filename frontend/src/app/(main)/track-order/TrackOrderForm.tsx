'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Search, Truck } from 'lucide-react';
import { Button } from '@/features/ui/Button';
import { FormBanner } from '@/features/ui/FormBanner';
import { cn, formatDate, formatPrice } from '@yord/ui';
import { trackOrderAction, type TrackedOrder } from './actions';

const STATUS_TONE = {
  positive: 'text-success',
  pending: 'text-accent',
  negative: 'text-danger',
  neutral: 'text-text-muted',
} as const;

/**
 * `paid`/`fulfilled` → success, `pending`/`unfulfilled` → accent, failures →
 * danger. These were raw `green-500`/`amber-500`/`red-500` palette classes;
 * there is no warning token, and the accent is the app's "needs attention"
 * colour on a page surface.
 */
function statusTone(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'paid':
    case 'fulfilled':
      return STATUS_TONE.positive;
    case 'pending':
    case 'unfulfilled':
      return STATUS_TONE.pending;
    case 'cancelled':
    case 'failed':
      return STATUS_TONE.negative;
    default:
      return STATUS_TONE.neutral;
  }
}

export function TrackOrderForm() {
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setIsLoading(true);

    try {
      const result = await trackOrderAction({ email, orderNumber });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOrder(result.order);
    } catch {
      setError('Could not look up your order right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="bg-surface-card border border-border-default p-8 mb-8">
        {error ? (
          <FormBanner tone="danger" className="mb-6">
            {error}
          </FormBanner>
        ) : null}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="track-order-number"
              className="block font-accent text-xs tracking-[0.1em] text-text-muted mb-2"
            >
              ORDER NUMBER
            </label>
            <input
              id="track-order-number"
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
              placeholder="e.g., YORD-1234567890"
              className="w-full h-12 px-4 bg-surface-raised border border-border-strong text-text-primary font-body placeholder:text-text-muted focus:border-accent"
            />
          </div>

          <div>
            <label
              htmlFor="track-order-email"
              className="block font-accent text-xs tracking-[0.1em] text-text-muted mb-2"
            >
              EMAIL ADDRESS
            </label>
            <input
              id="track-order-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="The email used for your order"
              className="w-full h-12 px-4 bg-surface-raised border border-border-strong text-text-primary font-body placeholder:text-text-muted focus:border-accent"
            />
          </div>

          <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
            <Search aria-hidden="true" size={18} />
            TRACK ORDER
          </Button>
        </div>
      </form>

      {/* Persistent live region: a node inserted at the same moment as the
          result is not reliably announced, so the region always exists. */}
      <div aria-live="polite">
        {order ? (
          <div className="bg-surface-card border border-border-default p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-accent text-xl tracking-wider text-text-secondary">
                ORDER {order.name}
              </h2>
              <span className={cn('font-accent text-sm tracking-wider', statusTone(order.financialStatus))}>
                {order.financialStatus?.toUpperCase() || 'PENDING'}
              </span>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 text-text-muted">
                <Calendar aria-hidden="true" size={18} />
                <span className="font-body text-sm">
                  Ordered on {formatDate(order.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-text-muted">
                <Truck aria-hidden="true" size={18} />
                <span className="font-body text-sm">
                  Fulfillment:{' '}
                  <span className={statusTone(order.fulfillmentStatus)}>
                    {order.fulfillmentStatus?.toUpperCase() || 'PROCESSING'}
                  </span>
                </span>
              </div>
            </div>

            <div className="border-t border-border-default pt-6">
              <div className="flex justify-between items-center">
                <span className="font-body text-text-muted">Total</span>
                <span className="font-heading text-2xl text-text-primary">
                  {formatPrice(order.totalPrice)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Help Section */}
      <div className="mt-8 text-center">
        <p className="font-body text-sm text-text-muted mb-4">
          Can&apos;t find your order or need help?
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 border border-text-muted text-text-muted font-accent text-sm tracking-[0.1em] hover:border-accent hover:text-accent transition-colors"
        >
          CONTACT SUPPORT
        </Link>
      </div>
    </>
  );
}
