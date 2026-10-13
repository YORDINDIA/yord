import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@yord/ui';
import { CtaLink } from '@/features/ui/CtaLink';
import type { ButtonVariant } from '@/features/ui/buttonStyles';

/**
 * The shared shell for the five policy pages (privacy, terms, cookies,
 * returns, shipping).
 *
 * They were five hand-rolled copies of the same page — icon circle, centred
 * h1, prose card, section rules — and had drifted: two heading treatments,
 * two "last updated" placements, three different hero paddings, and raw
 * palette greens/reds for the eligibility ticks. One shell, one type scale,
 * and the content of each page is data.
 *
 * The content model is deliberately small: a section is a heading plus a list
 * of blocks, and a block is one of the eight shapes these pages actually use.
 * A free-form JSX body would have kept the duplication this exists to remove.
 */

export interface PolicyBlockP {
  kind: 'p';
  text: ReactNode;
}

export interface PolicyBlockList {
  kind: 'list';
  items: ReactNode[];
}

/** Ticked / crossed eligibility lists (returns). */
export interface PolicyBlockCheckList {
  kind: 'checkList';
  tone: 'positive' | 'negative';
  items: ReactNode[];
}

/** Numbered how-to list (returns). */
export interface PolicyBlockSteps {
  kind: 'steps';
  items: { title: string; description: ReactNode }[];
}

/** Label → value rows, e.g. delivery times and shipping rates. */
export interface PolicyBlockRows {
  kind: 'rows';
  items: { label: ReactNode; value: ReactNode; tone?: 'accent' | 'success' | 'muted' }[];
}

/** h3 + paragraph groups inside one section (cookie types). */
export interface PolicyBlockSubsections {
  kind: 'subsections';
  items: { heading: string; text: ReactNode }[];
}

/** Boxed aside with an accent edge (the refund-timing note). */
export interface PolicyBlockNote {
  kind: 'note';
  text: ReactNode;
}

/** Boxed address / contact lines. */
export interface PolicyBlockContact {
  kind: 'contact';
  lines: ReactNode[];
}

export type PolicyBlock =
  | PolicyBlockP
  | PolicyBlockList
  | PolicyBlockCheckList
  | PolicyBlockSteps
  | PolicyBlockRows
  | PolicyBlockSubsections
  | PolicyBlockNote
  | PolicyBlockContact;

export interface PolicySection {
  heading: string;
  blocks: PolicyBlock[];
}

export interface PolicyHighlight {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
}

export interface PolicyCta {
  title: string;
  description: ReactNode;
  actions: { label: ReactNode; href: string; variant?: ButtonVariant }[];
}

export interface PolicyPageProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  /** Omit on a page with no published revision date (returns, shipping). */
  updated?: string;
  /** Optional three-up summary cards above the prose (returns, shipping). */
  highlights?: PolicyHighlight[];
  sections: PolicySection[];
  cta?: PolicyCta;
}

const ROW_TONE = {
  accent: 'text-accent',
  success: 'text-success',
  muted: 'text-text-secondary',
} as const;

function Block({ block }: { block: PolicyBlock }) {
  switch (block.kind) {
    case 'p':
      return (
        <p className="font-body text-base text-text-muted leading-relaxed">{block.text}</p>
      );

    case 'list':
      return (
        <ul className="list-disc list-inside space-y-2 ml-4 font-body text-base text-text-muted leading-relaxed">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'checkList': {
      const Icon = block.tone === 'negative' ? AlertCircle : CheckCircle;
      const tone = block.tone === 'negative' ? 'text-danger' : 'text-success';

      return (
        <ul className="space-y-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <Icon aria-hidden="true" className={cn('w-5 h-5 flex-shrink-0', tone)} />
              <span className="font-body text-base text-text-muted">{item}</span>
            </li>
          ))}
        </ul>
      );
    }

    case 'steps':
      return (
        <ol className="space-y-6">
          {block.items.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <div className="w-10 h-10 bg-accent-tint rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-accent text-accent">{i + 1}</span>
              </div>
              <div>
                <h3 className="font-accent text-text-secondary tracking-wider mb-1">
                  {step.title}
                </h3>
                <p className="font-body text-base text-text-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      );

    case 'rows':
      return (
        <dl className="divide-y divide-border-default">
          {block.items.map((row, i) => (
            <div key={i} className="flex justify-between items-center gap-4 py-3">
              <dt className="font-body text-text-muted">{row.label}</dt>
              <dd
                className={cn(
                  'font-accent tracking-wider text-right',
                  ROW_TONE[row.tone ?? 'accent'],
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      );

    case 'subsections':
      return (
        <div className="space-y-6">
          {block.items.map((sub) => (
            <div key={sub.heading}>
              <h3 className="font-accent text-sm tracking-wider text-accent mb-2">
                {sub.heading}
              </h3>
              <p className="font-body text-base text-text-muted leading-relaxed">{sub.text}</p>
            </div>
          ))}
        </div>
      );

    case 'note':
      return (
        <div className="bg-surface-raised p-4 border-l-4 border-accent">
          <p className="font-body text-base text-text-muted">{block.text}</p>
        </div>
      );

    case 'contact':
      return (
        <div className="bg-surface-raised p-4 space-y-1">
          {block.lines.map((line, i) => (
            <p key={i} className="font-body text-base text-text-muted">
              {line}
            </p>
          ))}
        </div>
      );
  }
}

export function PolicyPage({
  icon: Icon,
  title,
  description,
  updated,
  highlights,
  sections,
  cta,
}: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero. `pt-32` is the app's clearance under the fixed 80px header —
          the majority of content pages already used it, the rest used `pt-24`
          (16px of clearance) with no rule behind the difference. */}
      <section className="relative pt-32 pb-16">
        <div className="container-page text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Icon aria-hidden="true" className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-text-primary mb-6">
            {title}
          </h1>
          <p className="font-body text-text-muted max-w-2xl mx-auto">{description}</p>
          {updated ? (
            <p className="font-body text-sm text-text-muted mt-4">Last updated: {updated}</p>
          ) : null}
        </div>
      </section>

      {highlights ? (
        <section className="pb-16">
          <div className="container-page">
            <div className="grid md:grid-cols-3 gap-8">
              {highlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="bg-surface-card border border-border-default p-8 text-center"
                >
                  <highlight.icon aria-hidden="true" className="w-10 h-10 text-accent mx-auto mb-4" />
                  <h2 className="font-accent text-lg tracking-wider text-text-secondary mb-2">
                    {highlight.title}
                  </h2>
                  <p className="font-body text-sm text-text-muted">{highlight.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Prose + optional closing CTA, in one column so the two cards share a
          single rhythm instead of stacking two `pb-24` sections. */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-surface-card border border-border-default p-8 md:p-12 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-xl md:text-2xl text-text-primary mb-4">
                  {section.heading}
                </h2>
                <div className="space-y-4">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {cta ? (
            <div className="bg-surface-card border border-border-default p-8 md:p-12 text-center">
              <h2 className="font-display text-2xl text-text-primary mb-4">{cta.title}</h2>
              <p className="font-body text-text-muted mb-6">{cta.description}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {cta.actions.map((action) => (
                  <CtaLink key={action.href} href={action.href} variant={action.variant ?? 'primary'}>
                    {action.label}
                  </CtaLink>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
