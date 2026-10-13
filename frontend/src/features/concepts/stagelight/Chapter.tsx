import type { ReactNode } from 'react';
import { LightSweep } from './LightSweep';

export const CHAPTER_COUNT = '06';

/** The huge chapter figure. Sticky in the left gutter from `lg`, an in-flow heading below. */
export function Numeral({ n, title }: { n: string; title: string }) {
  return (
    <div className="sl-numeral" aria-hidden="true">
      <span className="sl-numeral__fig">{n}</span>
      <span className="sl-numeral__meta">
        <span className="sl-numeral__of">/{CHAPTER_COUNT}</span>
        <span className="sl-numeral__title">{title}</span>
      </span>
    </div>
  );
}

interface ChapterProps {
  n: string;
  title: string;
  id: string;
  /** Accessible name of the section. */
  label: string;
  /** `stage` is dark in both themes; `surface` follows the page theme. */
  tone: 'stage' | 'surface';
  /** Hand tone to the theme surface below (`out`) or from the one above (`in`). */
  feather?: 'out' | 'in';
  /** Colour of the boundary sweep when it differs from `tone` (a dark-to-light boundary wants gold). */
  sweep?: 'stage' | 'surface';
  children: ReactNode;
}

export function Chapter({ n, title, id, label, tone, feather, sweep = tone, children }: ChapterProps) {
  return (
    <section
      id={id}
      aria-label={label}
      data-tone={tone}
      data-feather={feather}
      className={`sl-chapter sl-ch-${id}`}
    >
      <LightSweep tone={sweep} />
      {feather && <div className="sl-feather" aria-hidden="true" />}
      <div className="sl-chapter__grid">
        <div className="sl-gutter">
          <Numeral n={n} title={title} />
        </div>
        <div className="sl-chapter__body">{children}</div>
      </div>
    </section>
  );
}
