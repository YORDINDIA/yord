/* Fixed geometry for StageRig. Every number here is a constant, so server and
   client render the same markup (no Math.random, no layout reads). */

export const VIEW_W = 800;
export const VIEW_H = 600;

export const TRUSS = { x1: 24, x2: VIEW_W, top: 34, bottom: 50, step: 22 };

/** Head pivot hangs below the truss; the lens (beam apex) sits LENS px along the head axis. */
export const PIVOT_Y = 64;
export const LENS = 28;
export const BEAM_LEN = 500;
/** Half-angles (deg) of the soft outer cone and the hot core. */
export const CONE = { outer: 9, core: 4.6 };

/* The YORD motif `M12 2L22 12L12 22L2 12Z` lives on a 24 grid. DIAMOND maps
   that grid into the rig's viewBox. */
export const DIAMOND = { cx: 470, cy: 352, s: 15 };
type Pt = readonly [number, number];
const g = ([x, y]: Pt): Pt => [DIAMOND.cx + (x - 12) * DIAMOND.s, DIAMOND.cy + (y - 12) * DIAMOND.s];
const fmt = (p: Pt) => `${p[0]},${p[1]}`;

const C: Pt = [12, 12];
const T: Pt = [12, 2];
const R: Pt = [22, 12];
const B: Pt = [12, 22];
const L: Pt = [2, 12];
const TR: Pt = [17, 7];
const BR: Pt = [17, 17];
const BL: Pt = [7, 17];
const TL: Pt = [7, 7];

export const OUTLINE_D = `M${fmt(g(T))}L${fmt(g(R))}L${fmt(g(B))}L${fmt(g(L))}Z`;

/* Eight facets, clockwise from the top. `fill` is the resting gold ramp, lit from
   the upper left; `at` is the centroid used to measure beam distance. */
const FACET_DEFS: ReadonlyArray<{ tri: readonly [Pt, Pt, Pt]; fill: string }> = [
  { tri: [C, T, TR], fill: '#E9B93C' },
  { tri: [C, TR, R], fill: '#B88A1E' },
  { tri: [C, R, BR], fill: '#8A650F' },
  { tri: [C, BR, B], fill: '#6E4F0B' },
  { tri: [C, B, BL], fill: '#7C5A0E' },
  { tri: [C, BL, L], fill: '#A87C18' },
  { tri: [C, L, TL], fill: '#F2CB55' },
  { tri: [C, TL, T], fill: '#FFE08A' },
];

export const FACETS = FACET_DEFS.map(({ tri, fill }) => {
  const pts = tri.map(g);
  return {
    points: pts.map(fmt).join(' '),
    fill,
    at: [
      (pts[0][0] + pts[1][0] + pts[2][0]) / 3,
      (pts[0][1] + pts[1][1] + pts[2][1]) / 3,
    ] as Pt,
  };
});

const FIXTURE_X = [100, 250, 400, 550, 700];
/* aim: rest angle (deg) toward the diamond. amp/period/phase: the slow sweep.
   lean: how far the pointer can swing this head. */
const SWEEP = [
  { amp: 9, period: 13, phase: 0.1, lean: 7 },
  { amp: 7, period: 9, phase: 0.55, lean: 8 },
  { amp: 10, period: 11, phase: 0.3, lean: 9 },
  { amp: 8, period: 15, phase: 0.8, lean: 8 },
  { amp: 11, period: 8, phase: 0.45, lean: 7 },
];

export const FIXTURES = FIXTURE_X.map((x, i) => {
  const tx = DIAMOND.cx + (i - 2) * 62;
  const ty = DIAMOND.cy - 20;
  const aim = (Math.atan2(-(tx - x), ty - PIVOT_Y - LENS) * 180) / Math.PI;
  return { x, aim, ...SWEEP[i] };
});

export const angleAt = (f: (typeof FIXTURES)[number], clock: number, lean: number) =>
  f.aim + f.amp * Math.sin((clock + f.phase) * Math.PI * 2) - lean * f.lean;

/** Perpendicular distance from point `at` to the beam axis through the head pivot. */
function beamDistance(fx: number, deg: number, at: Pt): number {
  const r = (deg * Math.PI) / 180;
  return Math.abs((at[0] - fx) * Math.cos(r) + (at[1] - PIVOT_Y) * Math.sin(r));
}

const SIGMA = 26;
/** 0.36 (unlit) to 1 (a beam axis crosses the facet), from the nearest beam. */
export function facetLight(angles: readonly number[], at: Pt): number {
  let nearest = Infinity;
  for (let i = 0; i < FIXTURES.length; i++) {
    nearest = Math.min(nearest, beamDistance(FIXTURES[i].x, angles[i], at));
  }
  const catchLight = Math.exp(-((nearest / SIGMA) ** 2));
  return Math.round((0.36 + 0.64 * catchLight) * 1000) / 1000;
}

/** Truss: two chords joined by a zigzag, built once. */
export const TRUSS_D = (() => {
  const { x1, x2, top, bottom, step } = TRUSS;
  let d = `M${x1} ${top}H${x2}M${x1} ${bottom}H${x2}M${x1} ${top}V${bottom}`;
  let up = false;
  for (let x = x1; x < x2; x += step) {
    d += `M${x} ${up ? top : bottom}L${Math.min(x + step, x2)} ${up ? bottom : top}`;
    up = !up;
  }
  return d;
})();
