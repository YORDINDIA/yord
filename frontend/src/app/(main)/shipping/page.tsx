import { Clock, Package, Shield, Truck } from 'lucide-react';
import { PolicyPage, type PolicySection } from '../_policy/PolicyPage';

export const metadata = {
  title: 'Shipping Information',
  description:
    'Delivery times and how shipping works across India — free on every order, with fast shipping above ₹1,999.',
  alternates: { canonical: '/shipping' },
};

const HIGHLIGHTS = [
  {
    icon: Package,
    title: 'FREE SHIPPING',
    description: (
      <>
        Free on every order
        <br />
        <span className="text-accent">Fast free above ₹1,999</span>
      </>
    ),
  },
  {
    icon: Clock,
    title: 'FAST DELIVERY',
    description: '3-7 business days across India',
  },
  {
    icon: Shield,
    title: 'SECURE PACKAGING',
    description: 'Premium packaging for every order',
  },
];

const SECTIONS: PolicySection[] = [
  {
    heading: 'Delivery Times',
    blocks: [
      {
        kind: 'rows',
        items: [
          { label: 'Metro Cities (Mumbai, Delhi, Bangalore, etc.)', value: '3-5 BUSINESS DAYS' },
          { label: 'Tier 2 Cities', value: '5-7 BUSINESS DAYS' },
          { label: 'Other Locations', value: '7-10 BUSINESS DAYS' },
          { label: 'Remote Areas', value: '10-14 BUSINESS DAYS' },
        ],
      },
      {
        kind: 'p',
        text: '* Delivery times are estimates and may vary during peak seasons or due to unforeseen circumstances.',
      },
    ],
  },
  {
    heading: 'Shipping Charges',
    blocks: [
      {
        kind: 'p',
        text: 'Shipping is free on every order. What the order value decides is speed, not price:',
      },
      {
        kind: 'rows',
        items: [
          { label: 'Orders above ₹1,999', value: 'FREE Fast Shipping', tone: 'success' },
          { label: 'Orders ₹1,999 and below', value: 'FREE Standard Shipping', tone: 'success' },
        ],
      },
    ],
  },
  {
    heading: 'Order Processing',
    blocks: [
      {
        kind: 'p',
        text: 'Orders placed before 2 PM IST on business days are typically processed and dispatched the same day. Orders placed after 2 PM or on weekends/holidays will be processed on the next business day.',
      },
      {
        kind: 'p',
        text: 'Once your order is shipped, you will receive an email with tracking information. You can also track your order by logging into your account.',
      },
    ],
  },
  {
    heading: 'Our Delivery Partners',
    blocks: [
      {
        kind: 'p',
        text: "We partner with India's most reliable courier services to ensure your merchandise reaches you safely and on time:",
      },
      {
        kind: 'list',
        items: ['Delhivery', 'BlueDart', 'DTDC', 'India Post'],
      },
    ],
  },
  {
    heading: 'Important Notes',
    blocks: [
      {
        kind: 'list',
        items: [
          'Please ensure your shipping address and phone number are correct to avoid delivery delays.',
          'Someone should be available at the delivery address to receive the package.',
          'In case of failed delivery attempts, the package will be returned to our warehouse.',
          'We currently do not offer Cash on Delivery (COD) option.',
          'For any shipping-related queries, contact us at support@yordindia.com',
        ],
      },
    ],
  },
];

export default function ShippingPage() {
  return (
    <PolicyPage
      icon={Truck}
      title="Shipping Information"
      description="We deliver your favorite artist merchandise across India with care and speed. Here's everything you need to know about our shipping process."
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
      cta={{
        title: 'Have shipping questions?',
        description: 'Our support team is happy to help with any shipping-related inquiries.',
        actions: [{ label: 'CONTACT SUPPORT', href: '/contact' }],
      }}
    />
  );
}
