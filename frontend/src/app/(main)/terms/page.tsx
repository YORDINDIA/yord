import { FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service | YORD India",
  description:
    "Read our terms of service for using YORD India website and purchasing merchandise.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-noir-950">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6">
            Terms of Service
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-2xl mx-auto">
            Please read these terms carefully before using our website and
            services.
          </p>
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-500 mt-4">
            Last updated: January 1, 2025
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="bg-noir-900 border border-noir-800 p-8 md:p-12 space-y-8">
            {/* Acceptance */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                1. ACCEPTANCE OF TERMS
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  By accessing and using the YORD India website (yordindia.com),
                  you accept and agree to be bound by these Terms of Service. If
                  you do not agree to these terms, please do not use our website
                  or services.
                </p>
                <p>
                  We reserve the right to modify these terms at any time. Your
                  continued use of the website following any changes constitutes
                  acceptance of those changes.
                </p>
              </div>
            </div>

            {/* Use of Website */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                2. USE OF WEBSITE
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  You agree to use our website only for lawful purposes. You may
                  not:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Use the website in any way that violates applicable laws
                  </li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Use automated tools to scrape or extract data</li>
                  <li>
                    Transmit malicious code or interfere with website
                    functionality
                  </li>
                  <li>Impersonate any person or entity</li>
                  <li>
                    Engage in any activity that could damage our reputation
                  </li>
                </ul>
              </div>
            </div>

            {/* Account */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                3. ACCOUNT REGISTRATION
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  To make purchases, you may need to create an account. You are
                  responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Providing accurate and complete information</li>
                  <li>Maintaining the security of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized use</li>
                </ul>
                <p className="mt-4">
                  We reserve the right to suspend or terminate accounts that
                  violate these terms.
                </p>
              </div>
            </div>

            {/* Products and Pricing */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                4. PRODUCTS AND PRICING
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  All products displayed on our website are subject to
                  availability. We reserve the right to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Limit quantities available for purchase</li>
                  <li>Modify or discontinue products without notice</li>
                  <li>Correct pricing errors at any time</li>
                  <li>Refuse or cancel orders affected by errors</li>
                </ul>
                <p className="mt-4">
                  All prices are displayed in Indian Rupees (INR) and include
                  applicable GST. Prices are subject to change without prior
                  notice.
                </p>
              </div>
            </div>

            {/* Orders */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                5. ORDERS AND PAYMENT
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  When you place an order, you are making an offer to purchase.
                  We may accept or decline your order at our discretion. An
                  order is confirmed only when you receive an order confirmation
                  email.
                </p>
                <p>
                  Payment must be made at the time of order through our secure
                  payment gateway (Razorpay). We accept major credit/debit
                  cards, UPI, net banking, and digital wallets.
                </p>
              </div>
            </div>

            {/* Intellectual Property */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                6. INTELLECTUAL PROPERTY
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  All content on this website, including text, graphics, logos,
                  images, and software, is the property of YORD India or our
                  licensors and is protected by intellectual property laws.
                </p>
                <p>
                  Artist merchandise is sold under license from the respective
                  artists and their authorized representatives. All artist
                  names, logos, and designs remain the property of the
                  respective rights holders.
                </p>
                <p>
                  You may not reproduce, distribute, modify, or create
                  derivative works of any content without our express written
                  permission.
                </p>
              </div>
            </div>

            {/* Limitation of Liability */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                7. LIMITATION OF LIABILITY
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  To the maximum extent permitted by law, YORD India shall not
                  be liable for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Indirect, incidental, or consequential damages</li>
                  <li>Loss of profits, data, or business opportunities</li>
                  <li>
                    Damages arising from use or inability to use our website
                  </li>
                  <li>
                    Delays in delivery due to circumstances beyond our control
                  </li>
                </ul>
                <p className="mt-4">
                  Our total liability shall not exceed the amount paid for the
                  specific product giving rise to the claim.
                </p>
              </div>
            </div>

            {/* Indemnification */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                8. INDEMNIFICATION
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  You agree to indemnify and hold harmless YORD India, its
                  officers, employees, and agents from any claims, damages, or
                  expenses arising from your use of the website or violation of
                  these terms.
                </p>
              </div>
            </div>

            {/* Governing Law */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                9. GOVERNING LAW
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  These terms shall be governed by and construed in accordance
                  with the laws of India. Any disputes arising from these terms
                  shall be subject to the exclusive jurisdiction of the courts
                  in Mumbai, Maharashtra.
                </p>
              </div>
            </div>

            {/* Severability */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                10. SEVERABILITY
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  If any provision of these terms is found to be unenforceable,
                  the remaining provisions shall continue in full force and
                  effect.
                </p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                11. CONTACT INFORMATION
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  For questions about these Terms of Service, please contact us:
                </p>
                <div className="bg-noir-800 p-4">
                  <p>YORD India</p>
                  <p>Email: info@yordindia.com</p>
                  <p>Gurgaon - 122001</p>
                  <p>Haryana, India</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
