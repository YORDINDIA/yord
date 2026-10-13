'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { cn } from '@yord/ui';
import { Container } from '@/features/ui/Container';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { SectionHeading } from '@/features/ui/SectionHeading';

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
  const panelId = useId();

  return (
    <div className="bg-surface-card border border-border-default">
      <div className="p-6 border-b border-border-default">
        <h2 className="font-accent text-xl tracking-wider text-text-secondary">{category.title}</h2>
      </div>
      <div className="divide-y divide-border-default">
        {category.items.map((item, index) => {
          const isOpen = openIndex === index;
          const id = `${panelId}-${index}`;
          return (
            <div key={item.question}>
              {/* Heading + button, not a bare button: this is how a screen
                  reader jumps between questions. */}
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-surface-raised/50 transition-colors motion-reduce:transition-none"
                >
                  <span className="font-body text-text-secondary pr-4">{item.question}</span>
                  {isOpen ? (
                    <ChevronUp aria-hidden="true" className="w-5 h-5 text-accent flex-shrink-0" />
                  ) : (
                    <ChevronDown aria-hidden="true" className="w-5 h-5 text-text-muted flex-shrink-0" />
                  )}
                </button>
              </h3>
              <div
                id={id}
                // `inert` when closed, so a collapsed answer is out of the
                // accessibility tree and cannot be tabbed into — `hidden` would
                // do the same but would kill the height transition.
                inert={!isOpen}
                className={cn(
                  'overflow-hidden transition-all duration-300 motion-reduce:transition-none',
                  isOpen ? 'max-h-96' : 'max-h-0'
                )}
              >
                <p className="px-6 pb-6 font-body text-sm text-text-muted leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FAQPageClient({ faqData }: { faqData: FAQCategory[] }) {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <section className="pt-32 pb-20">
        <Container>
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <HelpCircle aria-hidden="true" className="w-8 h-8 text-accent" />
          </div>
          <SectionHeading
            as="h1"
            align="center"
            title="Frequently Asked Questions"
            description="Find answers to common questions about orders, shipping, returns, and more. Can't find what you're looking for? Contact our support team."
          />
        </Container>
      </section>

      {/* FAQ Content */}
      <section className="pb-24">
        <Container size="narrow">
          {faqData.length === 0 ? (
            <EmptyState
              title="No questions published yet"
              message="Our FAQ is being updated. Contact support and we will answer directly."
            >
              <CtaLink href="/contact">Contact us</CtaLink>
            </EmptyState>
          ) : (
            <div className="space-y-8">
              {faqData.map((category) => (
                <FAQAccordion key={category.title} category={category} />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Contact CTA */}
      <section className="pb-24">
        <Container size="narrow">
          <div className="bg-surface-card border border-border-default p-12 text-center">
            <h2 className="font-display text-2xl text-text-primary mb-4">Still have questions?</h2>
            <p className="font-body text-text-muted mb-6">
              Our support team is here to help you with any questions or concerns.
            </p>
            <CtaLink href="/contact">Contact us</CtaLink>
          </div>
        </Container>
      </section>
    </div>
  );
}
