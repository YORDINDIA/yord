'use client';

import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@yord/ui';

/* Entrances move on the y axis only and never hide anything. Markup and CSS
   start at the resting pose, so the page reads in full without JS. Once JS runs,
   elements that are still below the fold get `data-armed` (held a little low)
   and `data-in` lets them rise when scrolled into view. Both attributes are set
   on the DOM directly, so scrolling never re-renders React. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || 'in' in el.dataset) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.88) {
      el.dataset.in = '';
      return;
    }
    el.dataset.armed = '';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.in = '';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('ht-rise', className)} style={{ '--d': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

export interface Segment {
  t: string;
  /** Rendered in the italic cut. */
  em?: boolean;
}

interface RevealTextProps {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  id?: string;
  segments: Segment[];
  className?: string;
  /** Rise on first paint (server-rendered), for the hero. */
  immediate?: boolean;
  /** Delay between words in ms. */
  step?: number;
}

/** Word-by-word rise: each word translates up by a few tenths of an em. */
export function RevealText({ as: Tag = 'p', id, segments, className, immediate = false, step = 55 }: RevealTextProps) {
  const ref = useReveal<HTMLSpanElement>();
  const words = segments.flatMap((seg) =>
    seg.t
      .split(' ')
      .filter(Boolean)
      .map((word) => ({ word, em: seg.em }))
  );
  return (
    <Tag id={id} className={className}>
      <span ref={ref} data-in={immediate ? '' : undefined} style={{ '--step': `${step}ms` } as CSSProperties}>
        {words.map(({ word, em }, i) => (
          <Fragment key={i}>
            <span className={cn('ht-w', em && 'ht-w--em')} style={{ '--i': i } as CSSProperties}>
              {word}
            </span>{' '}
          </Fragment>
        ))}
      </span>
    </Tag>
  );
}
