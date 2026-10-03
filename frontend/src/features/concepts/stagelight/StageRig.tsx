'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  animate,
  motion,
  motionValue,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import {
  BEAM_LEN,
  CONE,
  FACETS,
  FIXTURES,
  LENS,
  OUTLINE_D,
  PIVOT_Y,
  TRUSS,
  TRUSS_D,
  VIEW_H,
  VIEW_W,
  angleAt,
  facetLight,
} from './rig-geometry';

const GRADIENT_ID = 'sl-beam-fill';
const cone = (half: number) => {
  const w = Math.round(BEAM_LEN * Math.tan((half * Math.PI) / 180));
  return `0,0 ${-w},${BEAM_LEN} ${w},${BEAM_LEN}`;
};
const OUTER = cone(CONE.outer);
const CORE = cone(CONE.core);

function Fixture({ index, angle }: { index: number; angle: MotionValue<number> }) {
  const f = FIXTURES[index];
  const head = useRef<SVGGElement>(null);
  /* Written straight to the DOM: a pointer move must not re-render React. */
  useMotionValueEvent(angle, 'change', (v) => {
    head.current?.setAttribute('transform', `rotate(${v.toFixed(2)})`);
  });

  return (
    <g className={`sl-fixture sl-fixture-${index}`} transform={`translate(${f.x} ${PIVOT_Y})`}>
      <line x1="0" y1={TRUSS.bottom - PIVOT_Y} x2="0" y2="0" stroke="var(--text-on-media-muted)" strokeOpacity="0.6" strokeWidth="2" />
      <g ref={head} transform={`rotate(${angle.get().toFixed(2)})`}>
        <polygon points={`-7,2 7,2 11,${LENS} -11,${LENS}`} fill="var(--scrim)" stroke="var(--text-on-media-muted)" strokeOpacity="0.7" strokeWidth="1.2" strokeLinejoin="miter" />
        <line x1="-11" y1={LENS} x2="11" y2={LENS} stroke="var(--accent-on-media)" strokeWidth="2.4" />
        <g transform={`translate(0 ${LENS})`}>
          <polygon points={OUTER} fill={`url(#${GRADIENT_ID})`} fillOpacity="0.5" style={{ mixBlendMode: 'screen' }} />
          <polygon points={CORE} fill={`url(#${GRADIENT_ID})`} style={{ mixBlendMode: 'screen' }} />
        </g>
      </g>
      <circle r="3.2" fill="var(--scrim)" stroke="var(--text-on-media-muted)" strokeOpacity="0.8" strokeWidth="1.2" />
    </g>
  );
}

function Facet({ facet, angles }: { facet: (typeof FACETS)[number]; angles: MotionValue<number>[] }) {
  const light = useTransform(angles, (a) => facetLight(a as number[], facet.at));
  return (
    <motion.polygon
      points={facet.points}
      fill={facet.fill}
      stroke="var(--scrim)"
      strokeWidth="1.2"
      strokeLinejoin="miter"
      style={{ opacity: light }}
    />
  );
}

export function StageRig({ className }: { className?: string }) {
  const root = useRef<SVGSVGElement>(null);
  const inView = useInView(root);
  const reduce = useReducedMotion();
  const pointer = useMotionValue(0);
  const lean = useSpring(pointer, { stiffness: 38, damping: 14, mass: 1.2 });
  const clocks = useMemo(() => FIXTURES.map(() => motionValue(0)), []);
  const angles = useMemo(() => FIXTURES.map((f) => motionValue(angleAt(f, 0, 0))), []);

  useEffect(() => {
    if (reduce || !inView) return;
    const sync = (i: number) => angles[i].set(angleAt(FIXTURES[i], clocks[i].get(), lean.get()));
    const runs = FIXTURES.map((f, i) => {
      const from = clocks[i].get();
      return animate(clocks[i], [from, from + 1], { duration: f.period, ease: 'linear', repeat: Infinity });
    });
    const unsubs = [
      ...clocks.map((c, i) => c.on('change', () => sync(i))),
      lean.on('change', () => FIXTURES.forEach((_, i) => sync(i))),
    ];
    const onMove = (e: PointerEvent) => pointer.set((e.clientX / window.innerWidth - 0.5) * 2);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      runs.forEach((r) => r.stop());
      unsubs.forEach((off) => off());
      window.removeEventListener('pointermove', onMove);
    };
  }, [reduce, inView, clocks, angles, lean, pointer]);

  return (
    <svg
      ref={root}
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMaxYMin meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={BEAM_LEN}>
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--accent-on-media) 70%, #fff3cf)', stopOpacity: 0.55 }} />
          <stop offset="0.28" style={{ stopColor: 'var(--accent-on-media)', stopOpacity: 0.26 }} />
          <stop offset="0.62" style={{ stopColor: 'var(--accent-on-media)', stopOpacity: 0.09 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent-on-media)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      <path d={TRUSS_D} fill="none" stroke="var(--text-on-media-muted)" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />

      {FACETS.map((facet) => (
        <Facet key={facet.points} facet={facet} angles={angles} />
      ))}
      <motion.path
        d={OUTLINE_D}
        fill="none"
        stroke="var(--accent-on-media)"
        strokeWidth="2"
        strokeLinejoin="miter"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 1.8, delay: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      />

      {FIXTURES.map((f, i) => (
        <Fixture key={f.x} index={i} angle={angles[i]} />
      ))}
    </svg>
  );
}
