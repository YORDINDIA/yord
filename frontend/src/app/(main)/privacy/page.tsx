import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | YORD India",
  description:
    "Read our privacy policy to understand how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-noir-950">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6">
            Privacy Policy
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-2xl mx-auto">
            Your privacy is important to us. This policy explains how we
            collect, use, and protect your personal information.
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
            {/* Introduction */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                INTRODUCTION
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  Welcome to YORD India (&quot;we,&quot; &quot;our,&quot; or
                  &quot;us&quot;). We are committed to protecting your personal
                  information and your right to privacy. This Privacy Policy
                  explains how we collect, use, disclose, and safeguard your
                  information when you visit our website and use our services.
                </p>
                <p>
                  Please read this privacy policy carefully. If you do not agree
                  with the terms of this privacy policy, please do not access
                  the site.
                </p>
              </div>
            </div>

            {/* Information We Collect */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                INFORMATION WE COLLECT
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  We collect information that you provide directly to us,
                  including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Name, email address, and contact information</li>
                  <li>Billing and shipping addresses</li>
                  <li>
                    Payment information (processed securely through Razorpay)
                  </li>
                  <li>Order history and preferences</li>
                  <li>Communications and correspondence with us</li>
                  <li>Account credentials when you create an account</li>
                </ul>
                <p className="mt-4">
                  We automatically collect certain information when you visit
                  our website:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>IP address and device information</li>
                  <li>Browser type and operating system</li>
                  <li>Pages visited and time spent on our site</li>
                  <li>Referring website or source</li>
                </ul>
              </div>
            </div>

            {/* How We Use Information */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                HOW WE USE YOUR INFORMATION
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>We use the information we collect to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Process and fulfill your orders</li>
                  <li>Send order confirmations and shipping updates</li>
                  <li>
                    Respond to your inquiries and provide customer support
                  </li>
                  <li>Send promotional communications (with your consent)</li>
                  <li>Improve our website and services</li>
                  <li>Detect and prevent fraud</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </div>
            </div>

            {/* Information Sharing */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                INFORMATION SHARING
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>We may share your information with:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Shipping and logistics partners to deliver your orders
                  </li>
                  <li>Payment processors (Razorpay) to process transactions</li>
                  <li>Analytics providers to understand website usage</li>
                  <li>Legal authorities when required by law</li>
                </ul>
                <p className="mt-4">
                  We do not sell your personal information to third parties for
                  marketing purposes.
                </p>
              </div>
            </div>

            {/* Data Security */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                DATA SECURITY
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  We implement appropriate technical and organizational security
                  measures to protect your personal information. These include:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>SSL/TLS encryption for data transmission</li>
                  <li>
                    Secure payment processing through Razorpay (PCI-DSS
                    compliant)
                  </li>
                  <li>Regular security assessments</li>
                  <li>Limited access to personal information</li>
                </ul>
              </div>
            </div>

            {/* Cookies */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                COOKIES AND TRACKING
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  We use cookies and similar tracking technologies to enhance
                  your browsing experience, analyze site traffic, and
                  personalize content. You can control cookie preferences
                  through your browser settings.
                </p>
              </div>
            </div>

            {/* Your Rights */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                YOUR RIGHTS
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Access your personal information</li>
                  <li>Correct inaccurate information</li>
                  <li>Request deletion of your data</li>
                  <li>Opt-out of marketing communications</li>
                  <li>Data portability</li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, please contact us at{" "}
                  <a
                    href="mailto:privacy@yordindia.com"
                    className="text-gold-200 hover:text-gold-300 transition-colors"
                  >
                    privacy@yordindia.com
                  </a>
                </p>
              </div>
            </div>

            {/* Updates */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                POLICY UPDATES
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  We may update this privacy policy from time to time. We will
                  notify you of any changes by posting the new policy on this
                  page and updating the &quot;Last updated&quot; date.
                </p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100 mb-4">
                CONTACT US
              </h2>
              <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-4 leading-relaxed">
                <p>
                  If you have questions about this privacy policy or our
                  practices, please contact us:
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
