import { Package } from 'lucide-react';
import { TrackOrderForm } from './TrackOrderForm';

export const metadata = {
  title: 'Track Your Order',
  description:
    'Track your YORD India order — enter your order number and email address to see the latest status.',
  alternates: { canonical: '/track-order' },
};

/**
 * Server shell + client form. The lookup itself runs in a server action
 * (`./actions.ts`) so the order table is never queried from the browser.
 */
export default function TrackOrderPage() {
  return (
    <div className="min-h-screen bg-surface-page pt-32 pb-16">
      <div className="max-w-2xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Package aria-hidden="true" className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-4">
            Track Your Order
          </h1>
          <p className="font-body text-text-muted">
            Enter your order number and email to track your delivery.
          </p>
        </div>

        <TrackOrderForm />
      </div>
    </div>
  );
}
