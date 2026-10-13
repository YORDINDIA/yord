import { FileText } from 'lucide-react';
import { PolicyPage, type PolicySection } from '../_policy/PolicyPage';

export const metadata = {
  title: "Terms of Service",
  description:
    "Read our terms of service for using YORD India website and purchasing merchandise.",
  alternates: { canonical: '/terms' },
};

const SECTIONS: PolicySection[] = [
  {
    heading: '1. Acceptance of Terms',
    blocks: [
      {
        kind: 'p',
        text: 'By accessing and using the YORD India website (yordindia.com), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our website or services.',
      },
      {
        kind: 'p',
        text: 'We reserve the right to modify these terms at any time. Your continued use of the website following any changes constitutes acceptance of those changes.',
      },
    ],
  },
  {
    heading: '2. Use of Website',
    blocks: [
      { kind: 'p', text: 'You agree to use our website only for lawful purposes. You may not:' },
      {
        kind: 'list',
        items: [
          'Use the website in any way that violates applicable laws',
          'Attempt to gain unauthorized access to our systems',
          'Use automated tools to scrape or extract data',
          'Transmit malicious code or interfere with website functionality',
          'Impersonate any person or entity',
          'Engage in any activity that could damage our reputation',
        ],
      },
    ],
  },
  {
    heading: '3. Account Registration',
    blocks: [
      { kind: 'p', text: 'To make purchases, you may need to create an account. You are responsible for:' },
      {
        kind: 'list',
        items: [
          'Providing accurate and complete information',
          'Maintaining the security of your account credentials',
          'All activities that occur under your account',
          'Notifying us immediately of any unauthorized use',
        ],
      },
      {
        kind: 'p',
        text: 'We reserve the right to suspend or terminate accounts that violate these terms.',
      },
    ],
  },
  {
    heading: '4. Products and Pricing',
    blocks: [
      {
        kind: 'p',
        text: 'All products displayed on our website are subject to availability. We reserve the right to:',
      },
      {
        kind: 'list',
        items: [
          'Limit quantities available for purchase',
          'Modify or discontinue products without notice',
          'Correct pricing errors at any time',
          'Refuse or cancel orders affected by errors',
        ],
      },
      {
        kind: 'p',
        text: 'All prices are displayed in Indian Rupees (INR) and include applicable GST. Prices are subject to change without prior notice.',
      },
    ],
  },
  {
    heading: '5. Orders and Payment',
    blocks: [
      {
        kind: 'p',
        text: 'When you place an order, you are making an offer to purchase. We may accept or decline your order at our discretion. An order is confirmed only when you receive an order confirmation email.',
      },
      {
        kind: 'p',
        text: 'Payment must be made at the time of order through our secure payment gateway (Razorpay). We accept major credit/debit cards, UPI, net banking, and digital wallets.',
      },
    ],
  },
  {
    heading: '6. Intellectual Property',
    blocks: [
      {
        kind: 'p',
        text: 'All content on this website, including text, graphics, logos, images, and software, is the property of YORD India or our licensors and is protected by intellectual property laws.',
      },
      {
        kind: 'p',
        text: 'Artist merchandise is sold under license from the respective artists and their authorized representatives. All artist names, logos, and designs remain the property of the respective rights holders.',
      },
      {
        kind: 'p',
        text: 'You may not reproduce, distribute, modify, or create derivative works of any content without our express written permission.',
      },
    ],
  },
  {
    heading: '7. Limitation of Liability',
    blocks: [
      {
        kind: 'p',
        text: 'To the maximum extent permitted by law, YORD India shall not be liable for:',
      },
      {
        kind: 'list',
        items: [
          'Indirect, incidental, or consequential damages',
          'Loss of profits, data, or business opportunities',
          'Damages arising from use or inability to use our website',
          'Delays in delivery due to circumstances beyond our control',
        ],
      },
      {
        kind: 'p',
        text: 'Our total liability shall not exceed the amount paid for the specific product giving rise to the claim.',
      },
    ],
  },
  {
    heading: '8. Indemnification',
    blocks: [
      {
        kind: 'p',
        text: 'You agree to indemnify and hold harmless YORD India, its officers, employees, and agents from any claims, damages, or expenses arising from your use of the website or violation of these terms.',
      },
    ],
  },
  {
    heading: '9. Governing Law',
    blocks: [
      {
        kind: 'p',
        text: 'These terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in Mumbai, Maharashtra.',
      },
    ],
  },
  {
    heading: '10. Severability',
    blocks: [
      {
        kind: 'p',
        text: 'If any provision of these terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.',
      },
    ],
  },
  {
    heading: '11. Contact Information',
    blocks: [
      { kind: 'p', text: 'For questions about these Terms of Service, please contact us:' },
      {
        kind: 'contact',
        lines: ['YORD India', 'Email: info@yordindia.com', 'Gurgaon - 122001', 'Haryana, India'],
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      icon={FileText}
      title="Terms of Service"
      description="Please read these terms carefully before using our website and services."
      updated="January 1, 2025"
      sections={SECTIONS}
    />
  );
}
