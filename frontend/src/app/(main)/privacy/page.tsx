import { Shield } from 'lucide-react';
import { PolicyPage, type PolicySection } from '../_policy/PolicyPage';

export const metadata = {
  title: "Privacy Policy",
  description:
    "Read our privacy policy to understand how we collect, use, and protect your personal information.",
  alternates: { canonical: '/privacy' },
};

const SECTIONS: PolicySection[] = [
  {
    heading: 'Introduction',
    blocks: [
      {
        kind: 'p',
        text: (
          <>
            Welcome to YORD India (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are
            committed to protecting your personal information and your right to privacy. This
            Privacy Policy explains how we collect, use, disclose, and safeguard your information
            when you visit our website and use our services.
          </>
        ),
      },
      {
        kind: 'p',
        text: (
          <>
            Please read this privacy policy carefully. If you do not agree with the terms of this
            privacy policy, please do not access the site.
          </>
        ),
      },
    ],
  },
  {
    heading: 'Information We Collect',
    blocks: [
      { kind: 'p', text: 'We collect information that you provide directly to us, including:' },
      {
        kind: 'list',
        items: [
          'Name, email address, and contact information',
          'Billing and shipping addresses',
          'Payment information (processed securely through Razorpay)',
          'Order history and preferences',
          'Communications and correspondence with us',
          'Account credentials when you create an account',
        ],
      },
      { kind: 'p', text: 'We automatically collect certain information when you visit our website:' },
      {
        kind: 'list',
        items: [
          'IP address and device information',
          'Browser type and operating system',
          'Pages visited and time spent on our site',
          'Referring website or source',
        ],
      },
    ],
  },
  {
    heading: 'How We Use Your Information',
    blocks: [
      { kind: 'p', text: 'We use the information we collect to:' },
      {
        kind: 'list',
        items: [
          'Process and fulfill your orders',
          'Send order confirmations and shipping updates',
          'Respond to your inquiries and provide customer support',
          'Send promotional communications (with your consent)',
          'Improve our website and services',
          'Detect and prevent fraud',
          'Comply with legal obligations',
        ],
      },
    ],
  },
  {
    heading: 'Information Sharing',
    blocks: [
      { kind: 'p', text: 'We may share your information with:' },
      {
        kind: 'list',
        items: [
          'Shipping and logistics partners to deliver your orders',
          'Payment processors (Razorpay) to process transactions',
          'Analytics providers (Google Analytics and PostHog) to understand website usage',
          'Error monitoring (Sentry) to detect and fix problems on the site',
          'Legal authorities when required by law',
        ],
      },
      {
        kind: 'p',
        text: 'We do not sell your personal information to third parties for marketing purposes.',
      },
    ],
  },
  {
    heading: 'Data Security',
    blocks: [
      {
        kind: 'p',
        text: 'We implement appropriate technical and organizational security measures to protect your personal information. These include:',
      },
      {
        kind: 'list',
        items: [
          'SSL/TLS encryption for data transmission',
          'Secure payment processing through Razorpay (PCI-DSS compliant)',
          'Regular security assessments',
          'Limited access to personal information',
        ],
      },
    ],
  },
  {
    heading: 'Cookies and Tracking',
    blocks: [
      {
        kind: 'p',
        text: 'We use cookies and similar tracking technologies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookie preferences through your browser settings.',
      },
      {
        kind: 'p',
        text: "When you start checking out, we keep your in-progress order temporarily in your browser's session storage — including the contact and shipping details entered so far — and it is cleared automatically when you close the tab.",
      },
    ],
  },
  {
    heading: 'Your Rights',
    blocks: [
      { kind: 'p', text: 'You have the right to:' },
      {
        kind: 'list',
        items: [
          'Access your personal information',
          'Correct inaccurate information',
          'Request deletion of your data',
          'Opt-out of marketing communications',
          'Data portability',
        ],
      },
      {
        kind: 'p',
        text: (
          <>
            To exercise these rights, please contact us at{' '}
            <a
              href="mailto:privacy@yordindia.com"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              privacy@yordindia.com
            </a>
          </>
        ),
      },
    ],
  },
  {
    heading: 'Policy Updates',
    blocks: [
      {
        kind: 'p',
        text: 'We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.',
      },
    ],
  },
  {
    heading: 'Contact Us',
    blocks: [
      {
        kind: 'p',
        text: 'If you have questions about this privacy policy or our practices, please contact us:',
      },
      {
        kind: 'contact',
        lines: ['YORD India', 'Email: info@yordindia.com', 'Gurgaon - 122001', 'Haryana, India'],
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      icon={Shield}
      title="Privacy Policy"
      description="Your privacy is important to us. This policy explains how we collect, use, and protect your personal information."
      updated="January 1, 2025"
      sections={SECTIONS}
    />
  );
}
