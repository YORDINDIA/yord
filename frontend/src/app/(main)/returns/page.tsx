import Link from 'next/link';
import { RefreshCw, Package, Clock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Returns & Exchanges',
  description: 'Learn about our hassle-free return and exchange policy for merchandise purchased from YORD India.',
};

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-6">
            Returns & Exchanges
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted max-w-2xl mx-auto">
            We want you to love your purchase. If something isn&apos;t right,
            we&apos;re here to make it right with our hassle-free return policy.
          </p>
        </div>
      </section>

      {/* Policy Highlights */}
      <section className="px-6 lg:px-12 pb-16">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-surface-card border border-border-default p-8 text-center">
              <Clock className="w-10 h-10 text-accent mx-auto mb-4" />
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-text-secondary mb-2">
                14-DAY RETURNS
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                Return within 14 days of delivery
              </p>
            </div>
            <div className="bg-surface-card border border-border-default p-8 text-center">
              <RefreshCw className="w-10 h-10 text-accent mx-auto mb-4" />
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-text-secondary mb-2">
                FREE EXCHANGES
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                Free size exchanges on all orders
              </p>
            </div>
            <div className="bg-surface-card border border-border-default p-8 text-center">
              <Package className="w-10 h-10 text-accent mx-auto mb-4" />
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-text-secondary mb-2">
                EASY PROCESS
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                Simple online return request
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Policy */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Return Eligibility */}
          <div className="bg-surface-card border border-border-default p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
              RETURN ELIGIBILITY
            </h2>
            <div className="space-y-4">
              <p className="font-[family-name:var(--font-jakarta)] text-text-muted text-sm leading-relaxed">
                Items are eligible for return within 14 days of delivery if they meet the following conditions:
              </p>
              <ul className="space-y-3">
                {[
                  'Item is unworn, unwashed, and in original condition',
                  'Original tags and labels are still attached',
                  'Item is in its original packaging',
                  'No damage, stains, or alterations',
                  'Return request initiated within 14 days of delivery',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Non-Returnable Items */}
          <div className="bg-surface-card border border-border-default p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
              NON-RETURNABLE ITEMS
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted text-sm leading-relaxed mb-4">
              The following items cannot be returned or exchanged:
            </p>
            <ul className="space-y-3">
              {[
                'Items marked as "Final Sale" or "Non-Returnable"',
                'Customized or personalized merchandise',
                'Undergarments and innerwear',
                'Items damaged due to misuse or improper care',
                'Items returned without original tags and packaging',
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* How to Return */}
          <div className="bg-surface-card border border-border-default p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
              HOW TO INITIATE A RETURN
            </h2>
            <div className="space-y-6">
              {[
                {
                  step: '1',
                  title: 'Log Into Your Account',
                  description: 'Go to your account dashboard and navigate to "Order History".',
                },
                {
                  step: '2',
                  title: 'Select the Order',
                  description: 'Find the order containing the item you wish to return.',
                },
                {
                  step: '3',
                  title: 'Request Return',
                  description: 'Click "Request Return" and select the reason for your return.',
                },
                {
                  step: '4',
                  title: 'Pack the Item',
                  description: 'Pack the item securely in its original packaging with all tags attached.',
                },
                {
                  step: '5',
                  title: 'Ship It Back',
                  description: 'Use the prepaid shipping label we email you, or drop off at a designated location.',
                },
              ].map((step) => (
                <div key={step.step} className="flex gap-4">
                  <div className="w-10 h-10 bg-accent-tint rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-[family-name:var(--font-bebas)] text-accent">
                      {step.step}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-bebas)] text-text-secondary tracking-wider mb-1">
                      {step.title}
                    </h3>
                    <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Refund Information */}
          <div className="bg-surface-card border border-border-default p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
              REFUND INFORMATION
            </h2>
            <div className="space-y-4 font-[family-name:var(--font-jakarta)] text-sm text-text-muted leading-relaxed">
              <p>
                Once we receive and inspect your returned item, we will process your refund
                within 5-7 business days. The refund will be credited to your original payment method.
              </p>
              <div className="bg-surface-raised p-4 border-l-4 border-accent">
                <p className="text-text-muted">
                  <strong>Please Note:</strong> Depending on your bank or payment provider,
                  it may take an additional 5-10 business days for the refund to appear in your account.
                </p>
              </div>
              <p>
                Original shipping charges are non-refundable unless the return is due to our error
                (wrong item shipped, defective product, etc.).
              </p>
            </div>
          </div>

          {/* Exchanges */}
          <div className="bg-surface-card border border-border-default p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
              SIZE EXCHANGES
            </h2>
            <div className="space-y-4 font-[family-name:var(--font-jakarta)] text-sm text-text-muted leading-relaxed">
              <p>
                Need a different size? We offer free size exchanges on all orders.
                Simply initiate a return request and select &quot;Exchange - Different Size&quot; as the reason.
              </p>
              <p>
                Once we receive your item, we&apos;ll ship out the new size immediately.
                If the requested size is out of stock, we&apos;ll notify you and process a full refund.
              </p>
            </div>
          </div>

          {/* Damaged/Defective Items */}
          <div className="bg-surface-card border border-border-default p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-text-secondary mb-6">
              DAMAGED OR DEFECTIVE ITEMS
            </h2>
            <div className="space-y-4 font-[family-name:var(--font-jakarta)] text-sm text-text-muted leading-relaxed">
              <p>
                If you receive a damaged or defective item, please contact us within 48 hours
                of delivery with photos of the damage. We&apos;ll arrange a free return and
                send you a replacement at no additional cost.
              </p>
              <p>
                Email us at{' '}
                <a
                  href="mailto:support@yordindia.com"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  support@yordindia.com
                </a>
                {' '}with your order number and photos of the issue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="bg-surface-card border border-border-default p-12 text-center">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-4">
              Need help with a return?
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted mb-6">
              Our support team is ready to assist you with any return or exchange questions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/account/orders"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors"
              >
                VIEW MY ORDERS
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-text-muted text-text-secondary font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-text-secondary transition-colors"
              >
                CONTACT SUPPORT
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
