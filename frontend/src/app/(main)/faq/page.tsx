'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'Orders & Shipping',
    items: [
      {
        question: 'How long does shipping take?',
        answer: 'Standard shipping within India takes 5-7 business days. Metro cities typically receive orders within 3-5 business days. We offer express shipping options at checkout for faster delivery.',
      },
      {
        question: 'Do you ship internationally?',
        answer: 'Currently, we only ship within India. We are working on expanding to international shipping soon. Subscribe to our newsletter to be notified when we launch international delivery.',
      },
      {
        question: 'How can I track my order?',
        answer: 'Once your order ships, you\'ll receive an email with tracking information. You can also track your order by logging into your account and viewing your order history.',
      },
      {
        question: 'What are the shipping charges?',
        answer: 'We offer free shipping on all orders above ₹1,999. For orders below this amount, a flat shipping fee of ₹99 applies.',
      },
    ],
  },
  {
    title: 'Returns & Exchanges',
    items: [
      {
        question: 'What is your return policy?',
        answer: 'We accept returns within 14 days of delivery for unworn items with original tags attached. Items must be in their original packaging and condition.',
      },
      {
        question: 'How do I initiate a return?',
        answer: 'Log into your account, go to Order History, select the order you wish to return, and click "Request Return." Our team will process your request within 24-48 hours.',
      },
      {
        question: 'Can I exchange an item for a different size?',
        answer: 'Yes! We offer free size exchanges. Simply initiate a return request and select "Exchange" as the reason. Once we receive your item, we\'ll ship the new size.',
      },
      {
        question: 'When will I receive my refund?',
        answer: 'Refunds are processed within 5-7 business days after we receive and inspect the returned item. The refund will be credited to your original payment method.',
      },
    ],
  },
  {
    title: 'Products & Authenticity',
    items: [
      {
        question: 'What kind of merchandise do you sell?',
        answer: 'We sell fan-made, artist-inspired designs created with love by fans for fans. Our focus is on quality craftsmanship and celebrating the artists you love.',
      },
      {
        question: 'What sizes do you offer?',
        answer: 'Most items are available in sizes XS to 3XL. We provide detailed size guides on each product page to help you find your perfect fit.',
      },
      {
        question: 'Are the colors as shown in photos?',
        answer: 'We make every effort to display accurate colors. However, slight variations may occur due to different screen settings. Product descriptions include exact color details.',
      },
      {
        question: 'How do I care for my merchandise?',
        answer: 'Care instructions are printed on each item\'s label and included in the product description. Generally, we recommend machine washing cold and tumble drying on low.',
      },
    ],
  },
  {
    title: 'Payment & Security',
    items: [
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit/debit cards, UPI, net banking, and popular wallets through our secure Razorpay payment gateway.',
      },
      {
        question: 'Is my payment information secure?',
        answer: 'Yes. All payments are processed through Razorpay, which uses bank-level encryption to protect your information. We never store your card details.',
      },
      {
        question: 'Do you offer Cash on Delivery?',
        answer: 'Currently, we only accept online payments. This helps us maintain competitive pricing and faster shipping.',
      },
      {
        question: 'What currency are prices displayed in?',
        answer: 'All prices are displayed in Indian Rupees (INR). All applicable taxes (GST) are included in the displayed price.',
      },
    ],
  },
];

function FAQAccordion({ category }: { category: FAQCategory }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="bg-noir-900 border border-noir-800">
      <div className="p-6 border-b border-noir-800">
        <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100">
          {category.title}
        </h2>
      </div>
      <div className="divide-y divide-noir-800">
        {category.items.map((item, index) => (
          <div key={index}>
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-noir-800/50 transition-colors"
            >
              <span className="font-[family-name:var(--font-jakarta)] text-ivory-100 pr-4">
                {item.question}
              </span>
              {openIndex === index ? (
                <ChevronUp className="w-5 h-5 text-gold-200 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-ivory-500 flex-shrink-0" />
              )}
            </button>
            <div
              className={cn(
                'overflow-hidden transition-all duration-300',
                openIndex === index ? 'max-h-96' : 'max-h-0'
              )}
            >
              <p className="px-6 pb-6 font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                {item.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-noir-950">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <HelpCircle className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6">
            Frequently Asked Questions
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-2xl mx-auto">
            Find answers to common questions about orders, shipping, returns, and more.
            Can&apos;t find what you&apos;re looking for? Contact our support team.
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto space-y-8">
          {FAQ_DATA.map((category) => (
            <FAQAccordion key={category.title} category={category} />
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="bg-noir-900 border border-noir-800 p-12 text-center">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-4">
              Still have questions?
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 mb-6">
              Our support team is here to help you with any questions or concerns.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
            >
              CONTACT US
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
