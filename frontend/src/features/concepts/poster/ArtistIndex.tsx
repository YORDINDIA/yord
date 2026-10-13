'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Arrow } from './Arrow';

export interface IndexArtist {
  handle: string;
  name: string;
  image: string;
  color: string;
}

const PEEK_W = 240;
const PEEK_H = 300;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/* One <img> follows the pointer. Its position goes through CSS variables from
   a rAF loop that only runs while a name is hovered or focused: no React
   state changes per mouse move. Touch devices skip it, taps just navigate. */
function usePeek(
  listRef: React.RefObject<HTMLUListElement | null>,
  peekRef: React.RefObject<HTMLDivElement | null>,
  imgRef: React.RefObject<HTMLImageElement | null>
) {
  useEffect(() => {
    const list = listRef.current;
    const peek = peekRef.current;
    const img = imgRef.current;
    if (!list || !peek || !img) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const snap = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let active: HTMLAnchorElement | null = null;

    const place = (clientX: number, clientY: number) => {
      const flip = clientX + 28 + PEEK_W > window.innerWidth - 12;
      tx = flip ? clientX - 28 - PEEK_W : clientX + 28;
      ty = clamp(clientY - PEEK_H / 2, 12, window.innerHeight - PEEK_H - 12);
    };

    const frame = () => {
      const k = snap ? 1 : 0.2;
      const dx = tx - x;
      x += dx * k;
      y += (ty - y) * k;
      peek.style.setProperty('--px', `${x.toFixed(1)}px`);
      peek.style.setProperty('--py', `${y.toFixed(1)}px`);
      peek.style.setProperty('--pr', snap ? '0deg' : `${clamp(dx * 0.04, -7, 7).toFixed(2)}deg`);
      raf = active || Math.abs(dx) > 0.5 ? requestAnimationFrame(frame) : 0;
    };

    const show = (a: HTMLAnchorElement) => {
      if (a !== active) {
        active = a;
        img.src = a.dataset.img ?? '';
        peek.style.setProperty('--pc', a.dataset.color ?? 'transparent');
      }
      peek.dataset.on = '1';
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const hide = () => {
      active = null;
      peek.dataset.on = '';
    };

    const link = (e: Event) => (e.target as Element).closest<HTMLAnchorElement>('a[data-img]');
    const onOver = (e: PointerEvent) => {
      const a = link(e);
      if (!a) return;
      place(e.clientX, e.clientY);
      if (!active) {
        x = tx;
        y = ty;
      }
      show(a);
    };
    const onMove = (e: PointerEvent) => active && place(e.clientX, e.clientY);
    const onFocus = (e: FocusEvent) => {
      const a = link(e);
      if (!a) return;
      const r = a.getBoundingClientRect();
      place(r.right - 24, r.top + r.height / 2);
      x = tx;
      y = ty;
      show(a);
    };

    list.addEventListener('pointerover', onOver);
    list.addEventListener('pointermove', onMove);
    list.addEventListener('pointerleave', hide);
    list.addEventListener('focusin', onFocus);
    list.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      list.removeEventListener('pointerover', onOver);
      list.removeEventListener('pointermove', onMove);
      list.removeEventListener('pointerleave', hide);
      list.removeEventListener('focusin', onFocus);
      list.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide);
    };
  }, [listRef, peekRef, imgRef]);
}

export function ArtistIndex({ artists }: { artists: IndexArtist[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  usePeek(listRef, peekRef, imgRef);

  return (
    <section aria-labelledby="poster-artists" className="poster-sect" data-tone="page" data-from="page">
      <div className="poster-pad poster-index-head">
        <p className="poster-display poster-bignum" aria-hidden="true">
          {artists.length}
        </p>
        <div>
          <h2 id="poster-artists" className="poster-display poster-title poster-title-sm">
            Featured Artists
          </h2>
          <Link href="/artists" className="poster-textlink" data-cursor="pointer">
            All {artists.length} artists
            <Arrow className="poster-textlink-arrow" />
          </Link>
        </div>
      </div>

      <ul ref={listRef} className="poster-pad poster-index">
        {artists.map((a, i) => (
          <li key={a.handle}>
            <Link
              href={`/artist/${a.handle}`}
              data-img={a.image}
              data-color={a.color}
              data-cursor="pointer"
              className="poster-display"
              style={{ '--c': a.color } as React.CSSProperties}
            >
              <sup>{String(i + 1).padStart(2, '0')}</sup>
              {a.name}
            </Link>
          </li>
        ))}
      </ul>

      <div ref={peekRef} className="poster-peek" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- one swapped preview, not a layout image */}
        <img ref={imgRef} alt="" width={PEEK_W} height={PEEK_H} decoding="async" />
      </div>
    </section>
  );
}
