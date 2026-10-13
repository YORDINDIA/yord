import { ArrowRight, Clock, Package, RefreshCw } from 'lucide-react';
import { PolicyPage, type PolicySection } from '../_policy/PolicyPage';

export const metadata = {
  title: 'Returns & Exchanges',
  description: 'Learn about our hassle-free return and exchange policy for merchandise purchased from YORD India.',
  alternates: { canonical: '/returns' },
};

const HIGHLIGHTS = [
  {
    icon: Clock,
    title: '14-DAY RETURNS',
    description: 'Return within 14 days of delivery',
  },
  {
    icon: RefreshCw,
    title: 'FREE EXCHANGES',
    description: 'Free size exchanges on all orders',
  },
  {
    icon: Package,
    title: 'EASY PROCESS',
    description: 'Simple online return request',
  },
];

const SECTIONS: PolicySection[] = [
  {
    heading: 'Return Eligibility',
    blocks: [
      {
        kind: 'p',
        text: 'Items are eligible for return within 14 days of delivery if they meet the following conditions:',
      },
      {
        kind: 'checkList',
        tone: 'positive',
        items: [
          'Item is unworn, unwashed, and in original condition',
          'Original tags and labels are still attached',
          'Item is in its original packaging',
          'No damage, stains, or alterations',
          'Return request initiated within 14 days of delivery',
        ],
      },
    ],
  },
  {
    heading: 'Non-Returnable Items',
    blocks: [
      { kind: 'p', text: 'The following items cannot be returned or exchanged:' },
      {
        kind: 'checkList',
        tone: 'negative',
        items: [
          'Items marked as "Final Sale" or "Non-Returnable"',
          'Customized or personalized merchandise',
          'Undergarments and innerwear',
          'Items damaged due to misuse or improper care',
          'Items returned without original tags and packaging',
        ],
      },
    ],
  },
  {
    heading: 'How to Initiate a Return',
    blocks: [
      {
        kind: 'steps',
        items: [
          {
            title: 'Log Into Your Account',
            description: 'Go to your account dashboard and navigate to "Order History".',
          },
          {
            title: 'Select the Order',
            description: 'Find the order containing the item you wish to return.',
          },
          {
            title: 'Request Return',
            description: 'Click "Request Return" and select the reason for your return.',
          },
          {
            title: 'Pack the Item',
            description: 'Pack the item securely in its original packaging with all tags attached.',
          },
          {
            title: 'Ship It Back',
            description: 'Use the prepaid shipping label we email you, or drop off at a designated location.',
          },
        ],
      },
    ],
  },
  {
    heading: 'Refund Information',
    blocks: [
      {
        kind: 'p',
        text: 'Once we receive and inspect your returned item, we will process your refund within 5-7 business days. The refund will be credited to your original payment method.',
      },
      {
        kind: 'note',
        text: (
          <>
            <strong>Please Note:</strong> Depending on your bank or payment provider, it may take an
            additional 5-10 business days for the refund to appear in your account.
          </>
        ),
      },
      {
        kind: 'p',
        text: 'Shipping is free on every order, so there is no delivery charge to deduct from your refund.',
      },
    ],
  },
  {
    heading: 'Size Exchanges',
    blocks: [
      {
        kind: 'p',
        text: 'Need a different size? We offer free size exchanges on all orders. Simply initiate a return request and select "Exchange - Different Size" as the reason.',
      },
      {
        kind: 'p',
        text: 'Once we receive your item, we\'ll ship out the new size immediately. If the requested size is out of stock, we\'ll notify you and process a full refund.',
      },
    ],
  },
  {
    heading: 'Damaged or Defective Items',
    blocks: [
      {
        kind: 'p',
        text: 'If you receive a damaged or defective item, please contact us within 48 hours of delivery with photos of the damage. We\'ll arrange a free return and send you a replacement at no additional cost.',
      },
      {
        kind: 'p',
        text: (
          <>
            Email us at{' '}
            <a
              href="mailto:support@yordindia.com"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              support@yordindia.com
            </a>{' '}
            with your order number and photos of the issue.
          </>
        ),
      },
    ],
  },
];

export default function ReturnsPage() {
  return (
    <PolicyPage
      icon={RefreshCw}
      title="Returns & Exchanges"
      description="We want you to love your purchase. If something isn't right, we're here to make it right with our hassle-free return policy."
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
      cta={{
        title: 'Need help with a return?',
        description: 'Our support team is ready to assist you with any return or exchange questions.',
        actions: [
          {
            label: (
              <>
                VIEW MY ORDERS
                <ArrowRight size={16} />
              </>
            ),
            href: '/account/orders',
          },
          { label: 'CONTACT SUPPORT', href: '/contact', variant: 'secondary' },
        ],
      }}
    />
  );
}
