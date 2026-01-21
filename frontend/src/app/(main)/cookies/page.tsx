import { Cookie } from 'lucide-react';

export const metadata = {
  title: 'Cookie Policy | YORD India',
  description: 'Learn about how we use cookies on the YORD India website.',
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <Cookie className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-4">
            Cookie Policy
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-2xl mx-auto">
            This policy explains how we use cookies and similar technologies.
          </p>
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-500 mt-4">
            Last updated: January 1, 2025
          </p>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-noir-900 border border-noir-800 p-8 md:p-12 space-y-8">
            {/* What Are Cookies */}
            <section>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                WHAT ARE COOKIES?
              </h2>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                Cookies are small text files that are stored on your device when you visit a website.
                They help the website remember your preferences and improve your browsing experience.
                Cookies can be &quot;session&quot; cookies (deleted when you close your browser) or &quot;persistent&quot;
                cookies (remain on your device for a set period or until you delete them).
              </p>
            </section>

            {/* Types of Cookies */}
            <section>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                TYPES OF COOKIES WE USE
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-gold-200 mb-2">
                    ESSENTIAL COOKIES
                  </h3>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                    These cookies are necessary for the website to function properly. They enable core
                    features like shopping cart functionality, account authentication, and checkout.
                    Without these cookies, certain services cannot be provided.
                  </p>
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-gold-200 mb-2">
                    ANALYTICS COOKIES
                  </h3>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                    These cookies help us understand how visitors interact with our website by collecting
                    and reporting information anonymously. This helps us improve our website and services.
                  </p>
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-gold-200 mb-2">
                    FUNCTIONAL COOKIES
                  </h3>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                    These cookies allow the website to remember choices you make (such as your preferred
                    language or region) and provide enhanced, personalized features.
                  </p>
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-gold-200 mb-2">
                    MARKETING COOKIES
                  </h3>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                    These cookies are used to track visitors across websites. The intention is to display
                    ads that are relevant and engaging for individual users. You can opt out of these cookies.
                  </p>
                </div>
              </div>
            </section>

            {/* Managing Cookies */}
            <section>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                MANAGING COOKIES
              </h2>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed mb-4">
                Most web browsers allow you to control cookies through their settings. You can:
              </p>
              <ul className="list-disc list-inside font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-2 ml-4">
                <li>View what cookies are stored on your device</li>
                <li>Delete all or specific cookies</li>
                <li>Block cookies from specific or all websites</li>
                <li>Set preferences for different types of cookies</li>
              </ul>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed mt-4">
                Please note that blocking or deleting cookies may impact your browsing experience and
                some features of our website may not function properly.
              </p>
            </section>

            {/* Third-Party Cookies */}
            <section>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                THIRD-PARTY COOKIES
              </h2>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                Some cookies on our website are placed by third-party services, including payment
                processors (Razorpay), analytics services, and social media platforms. These third
                parties have their own privacy and cookie policies.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                CONTACT US
              </h2>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                If you have any questions about our use of cookies, please contact us at{' '}
                <a href="mailto:privacy@yordindia.com" className="text-gold-200 hover:underline">
                  privacy@yordindia.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
