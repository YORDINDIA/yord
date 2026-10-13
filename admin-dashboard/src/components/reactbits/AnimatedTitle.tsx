'use client';

import type { ElementType } from 'react';
import SplitText from './SplitText';

export interface AnimatedTitleProps {
  text: string;
  tag?: ElementType;
  className?: string;
}

/**
 * The page title, rising into place word by word on mount
 * (and on every route change, which is what makes navigation
 * read as a transition).
 *
 * Reduced motion needs no branch here: `SplitText` renders the
 * same unsplit markup it ships with and simply never animates,
 * so the server and the client always agree.
 */
export default function AnimatedTitle({ text, tag = 'h1', className }: AnimatedTitleProps) {
  return (
    <SplitText
      text={text}
      tag={tag as 'h1'}
      className={className}
      splitType="words"
      delay={40}
      duration={0.85}
      ease="power3.out"
      from={{ opacity: 0, y: 12 }}
      to={{ opacity: 1, y: 0 }}
      threshold={0.25}
      textAlign="left"
    />
  );
}
