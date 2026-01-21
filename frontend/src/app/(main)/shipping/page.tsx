import Link from 'next/link';
import { Truck, Package, Clock, MapPin, Shield, RefreshCw } from 'lucide-react';

export const metadata = {
  title: 'Shipping Information | YORD India',
  description: 'Learn about our shipping policies, delivery times, and shipping rates for orders across India.',
};

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-noir-950">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <Truck className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6">
            Shipping Information
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-2xl mx-auto">
            We deliver your favorite artist merchandise across India with care and speed.
            Here&apos;s everything you need to know about our shipping process.
          </p>
        </div>
      </section>

      {/* Shipping Highlights */}
      <section className="px-6 lg:px-12 pb-16">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-noir-900 border border-noir-800 p-8 text-center">
              <Package className="w-10 h-10 text-gold-200 mx-auto mb-4" />
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-2">
                FREE SHIPPING
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                On all orders above ₹1,999
              </p>
            </div>
            <div className="bg-noir-900 border border-noir-800 p-8 text-center">
              <Clock className="w-10 h-10 text-gold-200 mx-auto mb-4" />
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-2">
                FAST DELIVERY
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                3-7 business days across India
              </p>
            </div>
            <div className="bg-noir-900 border border-noir-800 p-8 text-center">
              <Shield className="w-10 h-10 text-gold-200 mx-auto mb-4" />
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-2">
                SECURE PACKAGING
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                Premium packaging for every order
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Info */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Delivery Times */}
          <div className="bg-noir-900 border border-noir-800 p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-6">
              DELIVERY TIMES
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-noir-800">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                  Metro Cities (Mumbai, Delhi, Bangalore, etc.)
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-gold-200 tracking-wider">
                  3-5 BUSINESS DAYS
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-noir-800">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                  Tier 2 Cities
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-gold-200 tracking-wider">
                  5-7 BUSINESS DAYS
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-noir-800">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                  Other Locations
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-gold-200 tracking-wider">
                  7-10 BUSINESS DAYS
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                  Remote Areas
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-gold-200 tracking-wider">
                  10-14 BUSINESS DAYS
                </span>
              </div>
            </div>
            <p className="mt-6 font-[family-name:var(--font-jakarta)] text-sm text-ivory-500">
              * Delivery times are estimates and may vary during peak seasons or due to unforeseen circumstances.
            </p>
          </div>

          {/* Shipping Rates */}
          <div className="bg-noir-900 border border-noir-800 p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-6">
              SHIPPING RATES
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-noir-800">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                  Orders above ₹1,999
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-green-400 tracking-wider">
                  FREE
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-noir-800">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                  Orders below ₹1,999
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-ivory-100 tracking-wider">
                  ₹99
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                  Express Shipping (available at checkout)
                </span>
                <span className="font-[family-name:var(--font-bebas)] text-ivory-100 tracking-wider">
                  ₹199
                </span>
              </div>
            </div>
          </div>

          {/* Order Processing */}
          <div className="bg-noir-900 border border-noir-800 p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-6">
              ORDER PROCESSING
            </h2>
            <div className="space-y-4 font-[family-name:var(--font-jakarta)] text-ivory-400 text-sm leading-relaxed">
              <p>
                Orders placed before 2 PM IST on business days are typically processed and dispatched
                the same day. Orders placed after 2 PM or on weekends/holidays will be processed on
                the next business day.
              </p>
              <p>
                Once your order is shipped, you will receive an email with tracking information.
                You can also track your order by logging into your account.
              </p>
            </div>
          </div>

          {/* Delivery Partners */}
          <div className="bg-noir-900 border border-noir-800 p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-6">
              OUR DELIVERY PARTNERS
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 text-sm leading-relaxed mb-4">
              We partner with India&apos;s most reliable courier services to ensure your merchandise
              reaches you safely and on time:
            </p>
            <ul className="grid grid-cols-2 gap-4">
              {['Delhivery', 'BlueDart', 'DTDC', 'India Post'].map((partner) => (
                <li key={partner} className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gold-200" />
                  <span className="font-[family-name:var(--font-jakarta)] text-ivory-300">
                    {partner}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Important Notes */}
          <div className="bg-noir-900 border border-noir-800 p-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-6">
              IMPORTANT NOTES
            </h2>
            <ul className="space-y-3">
              {[
                'Please ensure your shipping address and phone number are correct to avoid delivery delays.',
                'Someone should be available at the delivery address to receive the package.',
                'In case of failed delivery attempts, the package will be returned to our warehouse.',
                'We currently do not offer Cash on Delivery (COD) option.',
                'For any shipping-related queries, contact us at support@yordindia.com',
              ].map((note, index) => (
                <li key={index} className="flex items-start gap-3">
                  <RefreshCw className="w-4 h-4 text-gold-200 mt-0.5 flex-shrink-0" />
                  <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                    {note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="bg-noir-900 border border-noir-800 p-12 text-center">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-4">
              Have shipping questions?
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 mb-6">
              Our support team is happy to help with any shipping-related inquiries.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
            >
              CONTACT SUPPORT
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
