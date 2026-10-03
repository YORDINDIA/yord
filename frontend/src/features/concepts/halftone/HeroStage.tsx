'use client';

import { useEffect, useRef } from 'react';
import {
  paintDither,
  prefersReducedMotion,
  readTones,
  sampleLuma,
  sizeCanvas,
  smoothstep,
  type SampleOptions,
  type Shade,
} from './dither';

const CELL = 4;
const HOLD_MS = 6500;
const WIPE_MS = 1300;

const TEXT_BLOCKS = '.ht-hero__title, .ht-hero__aside, .ht-hero__stats, .ht-hero__caps';
const HEADER_BAND = 96;
/* How far, in px, the darkening fades out around a text block. */
const FEATHER = 110;
/* Clear space kept around every line of type. */
const PAD = 30;

type Zone = [left: number, top: number, right: number, bottom: number, strength: number];

/* The text is kept readable inside the dither itself: cells near each text block
   (and under the header) get fewer tone dots, so no overlay or grain touches the
   type, and the photo stays bright wherever there is no copy. */
function zoneShade(zones: Zone[], width: number, height: number, fadeBottom: boolean): Shade {
  return (u, v) => {
    const x = u * width;
    const y = v * height;
    let dark = 0;
    for (const [l, t, r, b, strength] of zones) {
      const d = Math.hypot(Math.max(l - x, 0, x - r), Math.max(t - y, 0, y - b));
      dark = Math.max(dark, strength * (1 - smoothstep(0, FEATHER, d)));
    }
    const edge = fadeBottom ? 1 - smoothstep(0.55, 1, v) : 1;
    return (1 - 0.995 * dark) * edge;
  };
}

const ease = (p: number) => 1 - Math.pow(1 - p, 3);

/* Full-bleed dithered stage photo. Every few seconds the next artist arrives by
   sweeping the Bayer threshold across the canvas. The loop idles off-screen,
   in a hidden tab, and under reduced motion (one static frame). */
export function HeroStage({ sources }: { sources: string[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const still = prefersReducedMotion();
    const tones = readTones(root);
    let alive = true;
    let version = 0;
    let index = 0;
    let cols = 0;
    let rows = 0;
    let frame0: Pick<SampleOptions, 'pos' | 'zoom'> = {};
    let shade: Shade | undefined;
    let shadeKey = '';
    let shown: Uint8ClampedArray | null = null;
    let onScreen = true;
    let frame = 0;
    let timer = 0;
    let resizeTimer = 0;

    const lumaOf = (i: number) =>
      sampleLuma(sources[i], cols, rows, { ...frame0, shade, shadeKey });

    const wipeTo = (target: Uint8ClampedArray, mine: number) =>
      new Promise<void>((resolve) => {
        const from = shown;
        const t0 = performance.now();
        const step = (now: number) => {
          if (!alive || mine !== version) return resolve();
          const p = Math.min(1, (now - t0) / WIPE_MS);
          paintDither(canvas, target, tones, p < 1 ? { from, progress: ease(p) } : undefined);
          if (p < 1) {
            frame = requestAnimationFrame(step);
          } else {
            shown = target;
            resolve();
          }
        };
        frame = requestAnimationFrame(step);
      });

    const layout = async () => {
      const rect = root.getBoundingClientRect();
      const mine = ++version;
      cols = Math.ceil(rect.width / CELL);
      rows = Math.ceil(rect.height / CELL);
      const zones: Zone[] = [[0, 0, rect.width, HEADER_BAND, 1]];
      const range = document.createRange();
      root.parentElement?.querySelectorAll(TEXT_BLOCKS).forEach((el) => {
        range.selectNodeContents(el);
        /* Line and word boxes, not the grid cell: the dark area hugs the type. */
        for (const r of range.getClientRects()) {
          zones.push([r.left - rect.left - PAD, r.top - rect.top - PAD, r.right - rect.left + PAD, r.bottom - rect.top + PAD, 1]);
        }
      });
      const narrow = rect.width < 1024;
      /* On a phone the photo window is small, so crop in on the lit stage. */
      frame0 = narrow ? { pos: [0.5, 0.8], zoom: 1.5 } : { pos: [0.5, 0.6] };
      shade = zoneShade(zones, rect.width, rect.height, narrow);
      shadeKey = `${narrow}|${zones.map((z) => z.map(Math.round).join(',')).join(';')}`;
      const luma = await lumaOf(index);
      if (!alive || mine !== version) return;
      sizeCanvas(canvas, cols, rows, CELL);
      if (still || shown || document.hidden) {
        shown = luma;
        paintDither(canvas, luma, tones);
      } else {
        await wipeTo(luma, mine);
      }
    };

    const cycle = async () => {
      if (!still) sources.forEach((_, i) => lumaOf(i).catch(() => undefined));
      while (alive && !still) {
        await new Promise<void>((resolve) => {
          timer = window.setTimeout(resolve, HOLD_MS);
        });
        if (!alive || !onScreen || document.hidden || !shown) continue;
        const mine = version;
        const next = (index + 1) % sources.length;
        const target = await lumaOf(next);
        if (!alive || mine !== version) continue;
        await wipeTo(target, mine);
        if (mine === version) index = next;
      }
    };

    /* Text blocks move when the web fonts land, so measure them after that. */
    document.fonts.ready
      .then(layout)
      .then(() => (alive ? cycle() : undefined))
      .catch(() => undefined);

    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    visibility.observe(root);
    const resize = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => layout().catch(() => undefined), 200);
    });
    resize.observe(root);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      clearTimeout(resizeTimer);
      visibility.disconnect();
      resize.disconnect();
    };
  }, [sources]);

  return (
    <div ref={rootRef} className="ht-hero__stage" aria-hidden="true">
      <canvas ref={canvasRef} className="ht-dither__canvas" />
    </div>
  );
}
