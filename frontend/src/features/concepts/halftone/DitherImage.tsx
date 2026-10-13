'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@yord/ui';
import { paintDither, prefersReducedMotion, readTones, sampleLuma, sizeCanvas } from './dither';
import { useThemeKey } from './useThemeKey';

interface DitherImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  style?: CSSProperties;
  /** CSS px per dither cell. */
  cell?: number;
  /** Lens radius in px, or 'fill' to uncover the whole photo on hover. */
  lens?: number | 'fill';
  /** Crop anchor as fractions of the source, [x, y]. */
  pos?: [number, number];
}

const DISSOLVE_MS = 900;

/* The artist photo as a two-tone dither. The true colour photo sits above the
   canvas behind a radial mask: a lens follows a fine pointer, and on touch the
   photo resolves once the tile is mostly in view. The mask radius is the
   registered property --r, so CSS owns the easing and React never re-renders
   on pointer moves. */
export function DitherImage({ src, alt, sizes, className, style, cell = 3, lens = 90, pos = [0.5, 0.35] }: DitherImageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const played = useRef(false);
  const drawn = useRef('');
  const pointer = useRef({ x: 0, y: 0, frame: 0 });
  const theme = useThemeKey();
  const [near, setNear] = useState(false);
  const [px, py] = pos;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!near || !root || !canvas) return;
    let alive = true;
    let frame = 0;
    let timer = 0;

    const draw = async () => {
      const { width, height } = root.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const cols = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);
      const key = `${src}|${cols}x${rows}|${theme}`;
      if (key === drawn.current) return;
      const luma = await sampleLuma(src, cols, rows, { pos: [px, py] });
      if (!alive) return;
      drawn.current = key;
      sizeCanvas(canvas, cols, rows, cell);
      const tones = readTones(root);
      if (played.current || document.hidden || prefersReducedMotion()) {
        played.current = true;
        paintDither(canvas, luma, tones);
        return;
      }
      played.current = true;
      const t0 = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - t0) / DISSOLVE_MS);
        paintDither(canvas, luma, tones, progress < 1 ? { from: null, progress } : undefined);
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    void draw();
    const resize = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => void draw(), 160);
    });
    resize.observe(root);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      resize.disconnect();
    };
  }, [near, theme, src, cell, px, py]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const tall = entry.intersectionRect.height >= window.innerHeight * 0.5;
        if (entry.intersectionRatio >= 0.6 || tall) {
          root.dataset.resolved = '';
          observer.disconnect();
        }
      },
      { threshold: [0, 0.25, 0.6, 1] }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const p = pointer.current;
    return () => cancelAnimationFrame(p.frame);
  }, []);

  const place = (root: HTMLDivElement, e: React.PointerEvent) => {
    const rect = root.getBoundingClientRect();
    root.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    root.style.setProperty('--my', `${e.clientY - rect.top}px`);
    return rect;
  };

  const open = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const rect = place(e.currentTarget, e);
    const radius = lens === 'fill' ? Math.hypot(rect.width, rect.height) : lens;
    e.currentTarget.style.setProperty('--r', `${radius}px`);
  };

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const root = e.currentTarget;
    const p = pointer.current;
    const rect = root.getBoundingClientRect();
    p.x = e.clientX - rect.left;
    p.y = e.clientY - rect.top;
    if (p.frame) return;
    p.frame = requestAnimationFrame(() => {
      p.frame = 0;
      root.style.setProperty('--mx', `${p.x}px`);
      root.style.setProperty('--my', `${p.y}px`);
    });
  };

  return (
    <div
      ref={rootRef}
      className={cn('ht-dither', className)}
      style={style}
      onPointerEnter={open}
      onPointerMove={track}
      onPointerLeave={(e) => e.currentTarget.style.removeProperty('--r')}
    >
      <canvas ref={canvasRef} className="ht-dither__canvas" aria-hidden="true" />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        draggable={false}
        className="ht-dither__photo"
        style={{ objectPosition: `${px * 100}% ${py * 100}%` }}
      />
    </div>
  );
}
