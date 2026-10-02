'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import { getSwatchId, subscribe } from './accent';

export interface StackItem {
  handle: string;
  name: string;
  image: string;
}

const SHUFFLE_MS = 2800;

/* The slot of each card (0 = front) lives in a data attribute; CSS owns the
   pose and the spring-like transition, so a shuffle is one state change. */
export function HeroStack({ items }: { items: StackItem[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState(() => items.map((i) => i.handle));
  const [onScreen, setOnScreen] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || !onScreen) return;
    const timer = setInterval(() => setOrder((o) => [...o.slice(1), o[0]]), SHUFFLE_MS);
    return () => clearInterval(timer);
  }, [reduce, onScreen]);

  // Picking an artist's swatch brings their photo to the front.
  useEffect(
    () =>
      subscribe(() => {
        const id = getSwatchId();
        setOrder((o) => (o.includes(id) ? [id, ...o.filter((h) => h !== id)] : o));
      }),
    []
  );

  return (
    <div ref={rootRef} className="poster-stack" aria-hidden="true">
      {items.map((item, i) => (
        <div key={item.handle} className="poster-card" data-slot={order.indexOf(item.handle)}>
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 32vw, 420px"
            priority={i < 2}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
