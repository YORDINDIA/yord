/* Two-tone ordered dither: 8x8 Bayer matrix, luminance threshold. One canvas
   pixel is one dither cell; CSS scales it up with `image-rendering: pixelated`,
   so a 640px photo can be shown large and the cells hide its softness. */

const BAYER = (() => {
  let m = [0];
  for (let n = 1; n < 8; n *= 2) {
    const s = n * 2;
    const next: number[] = new Array(s * s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const quad = (y >= n ? 2 : 0) + (x >= n ? 1 : 0);
        next[y * s + x] = 4 * m[(y % n) * n + (x % n)] + [0, 2, 3, 1][quad];
      }
    }
    m = next;
  }
  return Float32Array.from(m, (v) => (v + 0.5) / 64);
})();

/** Threshold in (0,1) for cell (x,y); dx/dy offset the matrix phase. */
export const bayer = (x: number, y: number, dx = 0, dy = 0) =>
  BAYER[(((y + dy) & 7) << 3) | ((x + dx) & 7)];

export function smoothstep(a: number, b: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* Colours --------------------------------------------------------------- */

/** A colour packed as little-endian 0xAABBGGRR, ready for a Uint32 view. */
export type Packed = number;

const packedCache = new Map<string, Packed>();
let probe: CanvasRenderingContext2D | null = null;

/* Canvas parses any CSS colour (hex, rgb, color-mix) once `var()` has already
   been substituted, which is what getPropertyValue returns for a custom prop. */
export function toPacked(css: string): Packed {
  const hit = packedCache.get(css);
  if (hit !== undefined) return hit;
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!probe) return 0xff000000;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  const value = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  packedCache.set(css, value);
  return value;
}

const lightness = (c: Packed) => 0.2126 * (c & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * ((c >> 16) & 255);

export interface Tones {
  ink: Packed;
  tone: Packed;
  /* True when the tone is the darker colour (light theme: bronze on alabaster).
     Dark source areas then become tone, like ink on paper. */
  invert: boolean;
}

export function readColor(el: Element, prop: string): Packed {
  return toPacked(getComputedStyle(el).getPropertyValue(prop).trim());
}

export function readTones(el: Element): Tones {
  const ink = readColor(el, '--ht-ink');
  const tone = readColor(el, '--ht-tone');
  return { ink, tone, invert: lightness(tone) < lightness(ink) };
}

/* Photos -------------------------------------------------------------- */

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`dither: cannot load ${src}`));
      img.src = src;
    });
    p.catch(() => images.delete(src));
    images.set(src, p);
  }
  return p;
}

/** Multiplier per cell (u, v in 0..1). Used to darken the text side in the dither itself. */
export type Shade = (u: number, v: number) => number;

export interface SampleOptions {
  pos?: [number, number];
  /** Scale beyond cover, to frame a detail. */
  zoom?: number;
  shade?: Shade;
  shadeKey?: string;
}

const lumaCache = new Map<string, Promise<Uint8ClampedArray>>();
const LUMA_CACHE_MAX = 160;
let scratch: CanvasRenderingContext2D | null = null;

function toLuma(img: HTMLImageElement, cols: number, rows: number, { pos = [0.5, 0.5], zoom = 1, shade }: SampleOptions) {
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!scratch) throw new Error('dither: no 2d context');
  scratch.canvas.width = cols;
  scratch.canvas.height = rows;
  scratch.imageSmoothingQuality = 'high';
  const scale = Math.max(cols / img.naturalWidth, rows / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  scratch.drawImage(img, (cols - dw) * pos[0], (rows - dh) * pos[1], dw, dh);
  const px = scratch.getImageData(0, 0, cols, rows).data;

  const n = cols * rows;
  const raw = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const l = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    raw[i] = l;
    hist[raw[i]]++;
  }
  /* Stretch between the 2nd and 98th percentile so dark stage photos still use the whole matrix. */
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc < n * 0.02) lo = v;
    if (acc < n * 0.98) hi = v;
  }
  const span = Math.max(40, hi - lo);

  const out = new Uint8ClampedArray(n);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const v = Math.min(1, Math.max(0, (raw[i] - lo) / span));
      out[i] = v * (shade ? shade(x / cols, y / rows) : 1) * 255;
    }
  }
  return out;
}

/** Cached per (src, size, crop, shade): resize and theme flips reuse it. */
export function sampleLuma(src: string, cols: number, rows: number, opts: SampleOptions = {}) {
  const key = `${src}|${cols}x${rows}|${opts.pos ?? ''}|${opts.zoom ?? 1}|${opts.shadeKey ?? ''}`;
  let p = lumaCache.get(key);
  if (!p) {
    p = loadImage(src).then((img) => toLuma(img, cols, rows, opts));
    p.catch(() => lumaCache.delete(key));
    lumaCache.set(key, p);
    if (lumaCache.size > LUMA_CACHE_MAX) lumaCache.delete(lumaCache.keys().next().value as string);
  }
  return p;
}

/* Painting --------------------------------------------------------------- */

export interface Wipe {
  /** What the cells not yet reached still show; null is bare ink. */
  from: Uint8ClampedArray | null;
  progress: number;
}

const FEATHER = 0.7;
const buffers = new WeakMap<HTMLCanvasElement, ImageData>();

/* Coverage curve. Dark concert photos are mostly shadow, so in the light theme (shadows become
   tone) linear coverage paints them almost solid; a stronger gamma lets the ground breathe. */
/* Coverage tops out below solid, so the darkest areas keep a few specks of ground instead of a flat slab. */
const PEAK = 236;
const luts: Record<string, Uint8Array> = {};
function coverageLut(invert: boolean) {
  const key = String(invert);
  const gamma = invert ? 1.6 : 0.9;
  luts[key] ??= Uint8Array.from({ length: 256 }, (_, l) => PEAK * Math.pow((invert ? 255 - l : l) / 255, gamma));
  return luts[key];
}

/** Paint `luma` as a two-tone dither. With `wipe`, the Bayer threshold sweeps across the canvas. */
export function paintDither(canvas: HTMLCanvasElement, luma: Uint8ClampedArray, t: Tones, wipe?: Wipe) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let img = buffers.get(canvas);
  if (!img || img.width !== w || img.height !== h) {
    img = ctx.createImageData(w, h);
    buffers.set(canvas, img);
  }
  const px = new Uint32Array(img.data.buffer);
  const lut = coverageLut(t.invert);
  const front = wipe ? wipe.progress * (1 + FEATHER) : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let l = luma[i];
      if (wipe && front - ((x / w) * 0.65 + (y / h) * 0.35) * FEATHER <= bayer(x, y, 5, 3)) {
        if (!wipe.from) {
          px[i] = t.ink;
          continue;
        }
        l = wipe.from[i];
      }
      px[i] = lut[l] > bayer(x, y) * 255 ? t.tone : t.ink;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Size a dither canvas to cols x rows cells; CSS size is cells x cell px. */
export function sizeCanvas(canvas: HTMLCanvasElement, cols: number, rows: number, cell: number) {
  canvas.width = cols;
  canvas.height = rows;
  canvas.style.width = `${cols * cell}px`;
  canvas.style.height = `${rows * cell}px`;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
