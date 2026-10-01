/**
 * Theme contract tests.
 *
 * Three rules, each encoding a decision that is easy to undo by accident and
 * expensive to notice:
 *
 *  1. No component may use a raw noir/gold/ivory colour class. Those ramps
 *     resolve to fixed values that do not flip with the theme, so a single
 *     `bg-noir-950` reintroduces a dark surface in light mode — and still looks
 *     correct in dark, which is why it survives review.
 *  2. Every semantic token must exist in BOTH `:root` and `[data-theme="dark"]`.
 *     A token defined in one and forgotten in the other does not error; it
 *     silently falls back to the light value, so a dark-themed page renders
 *     light values instead.
 *  3. The palette must keep clearing WCAG AA. Contrast is a property of a
 *     pair (text on its background), so it is asserted against the real token
 *     values rather than eyeballed.
 *
 * These read the real files and the real tokens. A test that re-implemented the
 * token map locally could not fail when the map changed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at frontend/src/lib/__tests__/theme.test.ts. The token file
// lives in the workspace package at the repo root, so walk up until the
// `packages` directory is found rather than counting `..` segments — a fixed
// count silently resolves one level short and fails as a confusing ENOENT.
function findRepoRoot(from: string): string {
  let dir = from;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'packages', 'ui', 'src', 'tokens.css'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('could not locate the repo root (no packages/ui/src/tokens.css)');
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = findRepoRoot(HERE);
const SRC = join(REPO, 'frontend', 'src');
const TOKENS_PATH = join(REPO, 'packages', 'ui', 'src', 'tokens.css');
const GLOBALS_PATH = join(SRC, 'app', 'globals.css');

function walk(dir: string, exts: string[] = ['.tsx', '.ts']): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * Parse `--name: value;` declarations out of one selector block.
 *
 * Comments are stripped first: the tokens file documents ratios inline, and a
 * comment terminator inside one otherwise swallows the next real declaration
 * and makes it look undefined.
 */
function declarations(css: string, selector: string): Map<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = clean.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = clean.indexOf('{', start);
  // Walk to the matching close brace so nested rules do not leak in.
  let depth = 0;
  let end = open;
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = clean.slice(open + 1, end);
  const map = new Map<string, string>();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

/** Resolve a token to a concrete colour, following var() hops. */
function resolve(value: string, table: Map<string, string>): string | null {
  const v = value.trim();
  const ref = v.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (ref) {
    const next = table.get(ref[1]);
    return next ? resolve(next, table) : null;
  }
  return v;
}

/** Composite a translucent colour over an opaque backdrop. */
function flatten(fg: string, bg: string): string | null {
  const f = fg.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
  const b = toRgb(bg);
  if (!f || !b) return null;
  const alpha = f[4] === undefined ? 1 : Number(f[4]);
  const fr = Number(f[1]);
  const fg_ = Number(f[2]);
  const fb = Number(f[3]);
  const mix = (x: number, y: number) => Math.round(x * alpha + y * (1 - alpha));
  return `rgb(${mix(fr, b[0])}, ${mix(fg_, b[1])}, ${mix(fb, b[2])})`;
}

function toRgb(colour: string): [number, number, number] | null {
  const hex = colour.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = colour.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/** WCAG 2.1 relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number | null {
  const ca = toRgb(a);
  const cb = toRgb(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const tokensCss = readFileSync(TOKENS_PATH, 'utf8');
// Anchor both slices to the real rule blocks. A bare indexOf is wrong here: the
// header comment names `[data-theme="dark"]` before the rule exists, and a media
// query further down declares a nested `:root` for the header height. Matching
// the selector at the start of a line finds the theme-carrying blocks.
const darkStart = tokensCss.search(/^\[data-theme="dark"\]\s*\{/m);
const rootStart = tokensCss.search(/^:root\s*\{/m);
if (rootStart === -1 || darkStart === -1 || darkStart <= rootStart) {
  throw new Error('could not locate the :root and [data-theme="dark"] blocks');
}
const rootBlock = tokensCss.slice(rootStart, darkStart);
const darkBlock = tokensCss.slice(darkStart);
const light = declarations(tokensCss, ':root');
const dark = declarations(tokensCss, '[data-theme="dark"]');

/**
 * Resolve a token to an opaque colour, compositing any alpha over `backdrop`.
 * Returns null when the token is not a colour at all.
 */
function opaque(value: string, backdrop: string): string | null {
  const v = value.trim();
  const withAlpha = v.match(
    /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i
  );
  const bd = toRgb(backdrop);
  if (!withAlpha) return v;
  if (!bd) return null;
  return flatten(v, backdrop);
}

/**
 * Contrast of a token against a backdrop, compositing translucent values.
 *
 * Dark `--accent-tint` is rgba(255,217,102,0.08) over the page rather than a
 * solid hex, so both sides have to be flattened onto a real backdrop before the
 * ratio means anything.
 */
function pairContrast(
  fgToken: string,
  bgToken: string,
  table: Map<string, string>,
  fallbackBackdrop: string
): number | null {
  const rawFg = resolve(table.get(fgToken) ?? '', table);
  const rawBg = resolve(table.get(bgToken) ?? '', table);
  if (!rawFg) return null;
  // The backdrop itself may be translucent, so flatten it onto the page first.
  const base = opaque(rawBg ?? '', fallbackBackdrop) ?? fallbackBackdrop;
  const backdrop = opaque(base, fallbackBackdrop) ?? fallbackBackdrop;
  const fg = opaque(rawFg, backdrop);
  if (!fg) return null;
  return contrast(fg, backdrop);
}

describe('semantic token contract', () => {
  // Tokens that are deliberately theme-invariant, so they are defined once in
  // `:root` and intentionally NOT overridden in `[data-theme="dark"]`.
  // Overriding one of these with a different value is the bug — see the
  // cross-theme equality tests below.
  const INVARIANT = [
    '--scrim',
    '--text-on-media',
    '--text-on-media-muted',
    '--accent-on-media',
    '--text-on-brand',
    '--brand-veil',
    '--coldplay-primary',
    '--coldplay-secondary',
    '--taylor-primary',
    '--taylor-secondary',
    '--diljit-primary',
    '--diljit-secondary',
    '--linkin-primary',
    '--linkin-secondary',
    '--weeknd-primary',
    '--weeknd-secondary',
    '--header-height',
    '--max-width',
    '--container-padding',
    '--transition-fast',
    '--transition-base',
    '--transition-slow',
    '--transition-luxury',
    // Legacy aliases. They delegate to themed tokens via var(), so they need no
    // dark override and must not get one.
    '--background',
    '--foreground',
    '--card',
    '--card-hover',
    '--border',
    '--muted',
  ];

  const isThemed = (name: string) =>
    !name.startsWith('--noir-') &&
    !name.startsWith('--gold-') &&
    !name.startsWith('--ivory-') &&
    name !== 'color-scheme' &&
    !INVARIANT.includes(name);

  const lightTokens = [...light.keys()].filter(isThemed);
  const darkTokens = [...dark.keys()].filter(isThemed);

  it('defines tokens in :root', () => {
    expect(lightTokens.length).toBeGreaterThan(20);
  });

  it('overrides every themed :root token in [data-theme="dark"]', () => {
    // A token present in one theme and missing in the other silently falls back
    // to the light value, so the dark page renders light.
    const missing = lightTokens.filter((t) => !darkTokens.includes(t));
    expect(missing).toEqual([]);
  });

  it('declares no dark-only token that :root does not define', () => {
    const extra = darkTokens.filter((t) => !lightTokens.includes(t));
    expect(extra).toEqual([]);
  });

  it('does not override the theme-invariant tokens in [data-theme="dark"]', () => {
    // If one of these drifts per theme, the hero or an artist button changes
    // appearance when the user switches. They must be declared once.
    const overridden = INVARIANT.filter((t) => dark.has(t));
    expect(overridden).toEqual([]);
  });

  it('sets color-scheme in both themes so form controls and scrollbars follow', () => {
    expect(/color-scheme\s*:\s*light/.test(rootBlock)).toBe(true);
    expect(/color-scheme\s*:\s*dark/.test(darkBlock)).toBe(true);
  });
});

describe('palette contrast (WCAG AA)', () => {
  const TEXT_PAIRS: Array<[string, string, number, string]> = [
    ['--text-primary', '--surface-page', 4.5, 'body text on the page'],
    ['--text-primary', '--surface-card', 4.5, 'body text on a card'],
    ['--text-primary', '--surface-raised', 4.5, 'body text on a raised surface'],
    ['--text-muted', '--surface-page', 4.5, 'muted text on the page'],
    ['--text-muted', '--surface-card', 4.5, 'muted text on a card'],
    ['--text-secondary', '--surface-page', 4.5, 'secondary text on the page'],
    ['--accent', '--surface-page', 4.5, 'accent text on the page'],
    ['--accent', '--surface-card', 4.5, 'accent text on a card'],
    ['--accent', '--accent-tint', 4.5, 'accent text on a gold tint panel'],
    ['--text-on-accent', '--accent', 4.5, 'label on an accent button'],
    ['--text-primary', '--accent-tint', 4.5, 'text on a gold tint panel'],
  ];

  const LARGE_PAIRS: Array<[string, string, number, string]> = [
    ['--text-subtle', '--surface-page', 3, 'decorative / large text only'],
  ];

  const NON_TEXT_PAIRS: Array<[string, string, number, string]> = [
    ['--border-strong', '--surface-page', 3, 'input edge'],
    ['--border-strong', '--surface-card', 3, 'input edge on a card'],
    ['--focus-ring', '--surface-page', 3, 'keyboard focus ring'],
    ['--focus-ring', '--surface-raised', 3, 'keyboard focus ring on a raised surface'],
  ];

  const ON_MEDIA_PAIRS: Array<[string, string, number, string]> = [
    ['--text-on-media', '--scrim', 4.5, 'hero text on its scrim'],
    ['--text-on-media-muted', '--scrim', 4.5, 'muted hero text on its scrim'],
    ['--accent-on-media', '--scrim', 4.5, 'accent text on the hero scrim'],
  ];

  for (const [themeName, table] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const [fg, bg, need, label] of TEXT_PAIRS) {
      it(`${themeName}: ${label} (${fg} on ${bg})`, () => {
        const ratio = pairContrast(fg, bg, table, table.get('--surface-page') as string);
        expect(ratio).not.toBeNull();
        expect(ratio as number).toBeGreaterThanOrEqual(need);
      });
    }
  }

  // The subtle token is legal only at 3:1, which is why it may not be used for
  // body copy. Asserting that it stays weaker than --text-muted keeps the two
  // distinguishable, so that restriction means something.
  for (const [fg, bg, need, label] of LARGE_PAIRS) {
    it(`light: ${label} (${fg} on ${bg})`, () => {
      const ratio = pairContrast(fg, bg, light, light.get('--surface-page') as string);
      expect(ratio).not.toBeNull();
      expect(ratio as number).toBeGreaterThanOrEqual(need);
      const muted = pairContrast(
        '--text-muted',
        bg,
        light,
        light.get('--surface-page') as string
      ) as number;
      expect(ratio as number).toBeLessThan(muted);
    });
  }

  for (const [fg, bg, need, label] of NON_TEXT_PAIRS) {
    for (const [themeName, table] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      it(`${themeName}: ${label} (${fg} on ${bg})`, () => {
        const ratio = pairContrast(fg, bg, table, table.get('--surface-page') as string);
        expect(ratio).not.toBeNull();
        expect(ratio as number).toBeGreaterThanOrEqual(need);
      });
    }
  }

  // On-media colours are theme-invariant, so one check covers both themes.
  for (const [fg, bg, need, label] of ON_MEDIA_PAIRS) {
    it(`on-media: ${label} (${fg} on ${bg})`, () => {
      const ratio = pairContrast(fg, bg, light, '#0A0A0A');
      expect(ratio).not.toBeNull();
      expect(ratio as number).toBeGreaterThanOrEqual(need);
    });
  }

  it('keeps on-media tokens out of the dark override block', () => {
    // They are declared once in `:root` and must never be re-declared for dark:
    // the hero is dark in both themes, so a per-theme value would make hero text
    // adapt to a light page it is not painted on.
    for (const token of [
      '--scrim',
      '--text-on-media',
      '--text-on-media-muted',
      '--accent-on-media',
    ]) {
      expect(light.get(token)).toBeTruthy();
      expect(dark.get(token)).toBeUndefined();
    }
  });

  it('keeps artist brand marks out of the dark override block', () => {
    for (const token of [
      '--coldplay-primary',
      '--taylor-primary',
      '--diljit-primary',
      '--linkin-primary',
      '--weeknd-primary',
      '--text-on-brand',
    ]) {
      expect(light.get(token)).toBeTruthy();
      expect(dark.get(token)).toBeUndefined();
    }
  });
});

describe('component palette discipline', () => {
  // `from-`/`via-`/`to-` are included: a scrim gradient built from a raw step is
  // exactly the case that breaks light mode.
  const RAW =
    /\b(?:bg|text|border|divide|ring|placeholder|outline|decoration|shadow|fill|stroke|accent|caret|from|via|to)-(?:noir|gold|ivory)-\d+\b/;

  it('no component uses a raw noir-/gold-/ivory- colour class', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.slice(SRC.length + 1);
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (RAW.test(line)) offenders.push(`${rel}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('globals.css no longer maps the raw ramps into Tailwind', () => {
    // This is what makes the rule above enforceable: with the ramps unmapped,
    // `bg-noir-950` compiles to nothing instead of quietly painting dark.
    const globals = readFileSync(GLOBALS_PATH, 'utf8');
    expect(globals).not.toMatch(/--color-(?:noir|gold|ivory)-\d+\s*:/);
    expect(globals).not.toMatch(/var\(--(?:noir|gold|ivory)-\d+\)/);
  });
});

describe('on-media context discipline', () => {
  // The bug that shipped: a full-bleed dark hero whose text used the
  // theme-following ink colour, so light mode painted near-black on near-black.
  // These components sit on a `bg-scrim` backdrop that is identical in both
  // themes, so every text token in them has to come from the on-media family.
  const MEDIA_HERO_FILES = [
    'features/home/HeroSection.tsx',
    'features/artist/ArtistHero.tsx',
  ];

  const THEME_FOLLOWING_TEXT =
    /\btext-(?:text-(?:primary|secondary|muted|subtle)|accent|accent-hover)\b/;

  it.each(MEDIA_HERO_FILES)(
    '%s uses only on-media text tokens',
    (rel) => {
      const src = readFileSync(join(SRC, rel), 'utf8');
      const offenders = src
        .split('\n')
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => THEME_FOLLOWING_TEXT.test(line))
        // `group-hover:` on an on-media element is expected to stay on-media,
        // and the plain `text-accent` prefix also matches `text-accent-on-media`.
        .filter(([, line]) => !line.includes('accent-on-media'))
        .map(([n]) => n);

      expect({ file: rel, offenders }).toEqual({ file: rel, offenders: [] });
    }
  );

  it('media heroes keep a dark backdrop in the light theme', () => {
    // `bg-surface-page` here would put the light page colour under a hero that
    // still uses on-media (ivory) text, which is what hid the logo.
    for (const rel of MEDIA_HERO_FILES) {
      const src = readFileSync(join(SRC, rel), 'utf8');
      expect(src, `${rel} must paint a scrim, not the page surface`).toMatch(
        /bg-scrim/
      );
    }
  });

  it('the transparent header stays light-on-dark over media routes', () => {
    // The header is transparent until scrolled, so on every full-bleed media
    // route it has to pick the on-media palette. Missing /artist/ here made the
    // whole header ink-on-black over ArtistHero.
    const header = readFileSync(
      join(SRC, 'features', 'layout', 'Header.tsx'),
      'utf8'
    );
    expect(header).toMatch(/pathname\.startsWith\('\/artist\/'\)/);
  });
});

describe('colour construction safety', () => {
  it('no inline style appends a hex alpha to a possibly-var() colour', () => {
    // `${accent}20` is only valid when the value is a hex literal. Once the
    // fallback became `var(--accent)` the whole declaration is dropped and the
    // element disappears, so any colour reaching a hex concat must be a hex.
    const concat = /\$\{([^}]+)\}([0-9A-Fa-f]{2})\b/g;
    const offenders: string[] = [];

    for (const file of walk(SRC).filter((f) => f.endsWith('.tsx'))) {
      const rel = file.slice(SRC.length + 1);
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const [, expr] of line.matchAll(concat)) {
            // Only the provably-broken shape is a value whose fallback is a
            // `var()` reference. A hex fallback (e.g. `x || '#1C1C1C'`) keeps
            // the concat valid, so it is not flagged.
            if (/\|\|\s*['"`]var\(--/.test(expr)) {
              offenders.push(`${rel}:${i + 1}`);
            }
          }
        });
    }

    expect(offenders).toEqual([]);
  });

  it('no hex alpha is concatenated onto a colour a caller may set to a token', () => {
    // ProductGallery's `accentColor` is a prop, and the product page passes
    // `artistData?.accentColor || 'var(--accent)'`. That makes `${accentColor}50`
    // dead CSS for any vendor without static artist data, so the gradient has to
    // use color-mix() instead.
    const gallery = readFileSync(
      join(SRC, 'features', 'product', 'ProductGallery.tsx'),
      'utf8'
    );
    const offenders = gallery
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /\$\{accentColor\}[0-9A-Fa-f]{2}\b/.test(line))
      .map(([n]) => n);

    expect({ offenders }).toEqual({ offenders: [] });
  });
});

describe('theme mechanism', () => {
  const globals = readFileSync(GLOBALS_PATH, 'utf8');

  it('declares the dark custom variant next-themes writes to', () => {
    expect(globals).toContain('@custom-variant dark');
    expect(globals).toMatch(/\[data-theme="dark"\]/);
  });

  it('maps semantic tokens through @theme inline so they flip at runtime', () => {
    // Without `inline`, Tailwind emits var(--color-x) which it owns, so the
    // cascade cannot re-point it and the theme would not switch.
    expect(globals).toMatch(/@theme inline\s*\{/);
    expect(globals).toMatch(/--color-surface-page:\s*var\(--surface-page\)/);
  });

  it('mounts the provider with light as the default', () => {
    const provider = readFileSync(join(SRC, 'providers', 'ThemeProvider.tsx'), 'utf8');
    expect(provider).toContain('defaultTheme="light"');
    expect(provider).toContain('enableSystem');
    expect(provider).toContain('attribute="data-theme"');
    // Namespaced per app: both apps serve :3000 in development.
    expect(provider).toContain('yord-storefront-theme');
  });

  it('does not hardcode a dark class on the html element', () => {
    const layout = readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/className=\{?["`][^"`]*\bdark\b/);
    expect(layout).toContain('suppressHydrationWarning');
  });
});
