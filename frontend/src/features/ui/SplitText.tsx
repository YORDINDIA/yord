'use client';

import { motion } from 'framer-motion';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  duration?: number;
}

export function SplitText({
  text,
  className = '',
  delay = 0,
  staggerDelay = 0.03,
  duration = 0.6,
}: SplitTextProps) {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block whitespace-nowrap">
          {word.split('').map((char, charIndex) => {
            const overallIndex =
              words.slice(0, wordIndex).join(' ').length + charIndex + wordIndex;
            return (
              <span
                key={charIndex}
                className="inline-block overflow-hidden"
              >
                <motion.span
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    delay: delay + overallIndex * staggerDelay,
                    duration: duration,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              </span>
            );
          })}
          {wordIndex < words.length - 1 && (
            <span className="inline-block">&nbsp;</span>
          )}
        </span>
      ))}
    </span>
  );
}

interface SplitTextLineProps {
  children: string;
  className?: string;
  delay?: number;
  duration?: number;
}

export function SplitTextLine({
  children,
  className = '',
  delay = 0,
  duration = 0.8,
}: SplitTextLineProps) {
  return (
    <span className="inline-block overflow-hidden">
      <motion.span
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{
          delay,
          duration,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`inline-block ${className}`}
      >
        {children}
      </motion.span>
    </span>
  );
}
