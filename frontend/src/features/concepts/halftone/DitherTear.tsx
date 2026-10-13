'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { bayer, readColor, sizeCanvas, smoothstep, type Packed } from './dither';
import { useThemeKey } from './useThemeKey';

const CELL = 4;
/* Share of the strip, at its centre, that carries stray tone dots. */
const DOT_PEAK = 0.3;

interface DitherTearProps {
  /** CSS colour of the section above. */
  from: string;
  /** CSS colour of the section below. */
  to: string;
  /** CSS colour of the stray dots in the seam. */
  dot?: string;
  height?: number;
}

/* Cheap per-cell hash in 0..1. */
const grain = (x: number, y: number) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;

function paintTear(canvas: HTMLCanvasElement, a: Packed, b: Packed, dot: Packed) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(w, h);
  const px = new Uint32Array(img.data.buffer);
  for (let x = 0; x < w; x++) {
    /* Slow waves push the boundary up and down per column: a torn edge, not a ruler line. */
    const sway = (0.5 * Math.sin(x * 0.043) + 0.3 * Math.sin(x * 0.131 + 2) + 0.2 * Math.sin(x * 0.37 + 5)) * 0.2;
    for (let y = 0; y < h; y++) {
      const t = (y + 0.5) / h;
      /* The bell keeps both edges of the strip pure, so no seam shows against the sections. */
      const cover = smoothstep(0.1, 0.9, t + sway * 4 * t * (1 - t));
      const dots = DOT_PEAK * Math.pow(1 - Math.abs(2 * t - 1), 1.6);
      /* A little grain on the stray dots keeps them from locking into a ruled lattice. */
      const speck = bayer(x, y, 5, 3) * 0.7 + grain(x, y) * 0.3;
      px[y * w + x] = dots > speck ? dot : cover > bayer(x, y) ? b : a;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* A stippled handoff between two sections: the top colour dissolves into the
   bottom one through the same Bayer matrix as the photos. The CSS gradient is
   only the no-JS fallback. */
export function DitherTear({ from, to, dot = 'var(--accent)', height = 160 }: DitherTearProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useThemeKey();

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    let timer = 0;
    const draw = () => {
      if (!root.clientWidth) return;
      sizeCanvas(canvas, Math.ceil(root.clientWidth / CELL), Math.ceil(height / CELL), CELL);
      paintTear(canvas, readColor(root, '--tear-a'), readColor(root, '--tear-b'), readColor(root, '--tear-dot'));
    };
    draw();
    const resize = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(draw, 120);
    });
    resize.observe(root);
    return () => {
      clearTimeout(timer);
      resize.disconnect();
    };
  }, [theme, height, from, to, dot]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="ht-tear"
      style={{ height, '--tear-a': from, '--tear-b': to, '--tear-dot': dot } as CSSProperties}
    >
      <canvas ref={canvasRef} className="ht-tear__canvas" />
    </div>
  );
}
