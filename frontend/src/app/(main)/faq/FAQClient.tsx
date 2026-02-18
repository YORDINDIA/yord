'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQCategory {
  title: string;
  items: FAQItem[];
}

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

export function FAQPageClient({ faqData }: { faqData: FAQCategory[] }) {
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
          {faqData.map((category) => (
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
