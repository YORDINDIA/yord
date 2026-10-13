'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { cn } from '@yord/ui';
import type { RailPiece } from './pieces';
import type { RailScene } from './RailScene';
import { HungCard } from './HungCard';
import { PieceSheet } from './PieceSheet';
import { Chevron, MotionMark } from './Glyphs';

const RailStage = dynamic(() => import('./RailStage'), { ssr: false });

const pad = (n: number) => String(n).padStart(2, '0');

/* Reduced motion, read so that server and hydration agree (false), then the
   real value. It also follows a change of the OS setting. */
const REDUCE = '(prefers-reduced-motion: reduce)';
const subscribeReduce = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getReduce = () => window.matchMedia(REDUCE).matches;
const getServerReduce = () => false;

/* Where the picked piece moves so the sheet does not cover it: right of the
   sheet on a wide screen, above the bottom sheet on a narrow one. */
function pickShift(): { x: number; y: number } {
  return window.matchMedia('(min-width: 960px)').matches ? { x: 0.16, y: 0 } : { x: 0, y: -0.2 };
}

export function RailHero({ pieces, loadFailed }: { pieces: RailPiece[]; loadFailed: boolean }) {
  const reduced = useSyncExternalStore(subscribeReduce, getReduce, getServerReduce);
  const [userMotion, setUserMotion] = useState<boolean | null>(null);
  const motion = userMotion ?? !reduced;
  // Open mid-rail, so garments hang on both sides of the one in front.
  const [start] = useState(() => Math.max(0, Math.floor((pieces.length - 1) / 2)));
  const [index, setIndex] = useState(start);
  const [picked, setPicked] = useState<number | null>(null);
  // Focus moves into the sheet when it opens, not when browsing swaps it.
  const [sheetFocus, setSheetFocus] = useState(true);
  const [ready, setReady] = useState(false);
  const [glFailed, setGlFailed] = useState(false);
  const [colors, setColors] = useState<(string | null)[]>([]);
  const api = useRef<RailScene | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [textures] = useState(() => pieces.map((p) => p.texture));

  const total = pieces.length;
  const current = pieces[index];
  const live = ready && !glFailed;

  const pick = useCallback((i: number, browsing = false) => {
    if (i < 0) {
      setPicked(null);
      return;
    }
    setSheetFocus(!browsing);
    setIndex(i);
    setPicked(i);
    api.current?.setPicked(i, pickShift());
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(total - 1, i));
      // With a piece open, browsing opens the next piece in the sheet too.
      if (picked !== null && api.current) {
        pick(next, true);
        return;
      }
      setIndex(next);
      api.current?.goTo(next);
      if (!api.current) {
        document.getElementById(`rl-dom-${next}`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: motion ? 'smooth' : 'auto' });
      }
    },
    [total, motion, picked, pick]
  );

  const unpick = useCallback(() => {
    setPicked(null);
    api.current?.setPicked(null);
    openerRef.current?.focus({ preventScroll: true });
  }, []);

  if (total === 0) {
    return (
      <section className="rl-hero rl-hero--empty" aria-labelledby="rl-title">
        <h1 id="rl-title" className="rl-display">The collection.</h1>
        <p className="rl-muted">
          {loadFailed ? 'The rail is not loading right now. Reload in a moment, or ' : 'The rail is empty for now. '}
          <Link href="/collections" className="rl-link">browse all collections</Link>.
        </p>
      </section>
    );
  }

  return (
    <section className="rl-hero" aria-labelledby="rl-title" data-picked={picked !== null || undefined}>
      <div className="rl-hero__head">
        <h1 id="rl-title" className="rl-display">
          The collection.
        </h1>
        <div className="rl-hero__vol">
          <p>
            The rail
            <span>Volume 001 / 2026</span>
          </p>
          {!glFailed && (
            <button
              type="button"
              className="rl-motion"
              aria-pressed={motion}
              onClick={() => setUserMotion(!motion)}
            >
              <MotionMark on={motion} />
              {motion ? 'Motion on' : 'Motion off'}
            </button>
          )}
        </div>
      </div>

      <div className={cn('rl-stage', live && 'is-live')}>
        {/* Server-rendered and visible until the WebGL rail has drawn. Then it
            stays only as the no-JS and no-WebGL path. */}
        <ol className="rl-domrail" aria-label="The full collection" inert={live || undefined}>
          {pieces.map((p, i) => (
            <li key={p.key} id={`rl-dom-${i}`}>
              <HungCard
                handle={p.handle}
                title={p.title}
                artist={p.artist}
                price={p.price}
                compareAtPrice={p.compareAtPrice}
                image={p.image}
                sizes="(min-width: 960px) 22vw, 60vw"
                priority={Math.abs(i - start) <= 2}
              />
            </li>
          ))}
        </ol>
        {!glFailed && (
          <RailStage
            textures={textures}
            start={start}
            motion={motion}
            apiRef={api}
            onIndex={setIndex}
            onPick={pick}
            onColors={setColors}
            onReady={() => setReady(true)}
            onFail={() => setGlFailed(true)}
          />
        )}
      </div>

      <div className="rl-controls">
        <p className="rl-count">
          <span className="sr-only">
            Piece {index + 1} of {total}
          </span>
          <span className="rl-count__now" aria-hidden="true">{pad(index + 1)}</span>
          <svg className="rl-count__track" viewBox="0 0 64 4" aria-hidden="true" focusable="false">
            <line x1="2" y1="2" x2="62" y2="2" />
            <line
              x1="2"
              y1="2"
              x2="62"
              y2="2"
              pathLength={1}
              className="rl-count__fill"
              style={{ strokeDashoffset: 1 - (index + 1) / total }}
            />
          </svg>
          <span aria-hidden="true">{pad(total)}</span>
        </p>

        <div className="rl-caption" aria-live="polite">
          {live ? (
            <button ref={openerRef} type="button" className="rl-caption__title" onClick={() => pick(index)}>
              {current.title}
            </button>
          ) : (
            <Link href={`/product/${current.handle}`} className="rl-caption__title">
              {current.title}
            </Link>
          )}
          <p className="rl-caption__hint">{live ? 'Drag to browse. Pick a piece.' : 'Scroll to browse. Pick a piece.'}</p>
        </div>

        <div className="rl-arrows">
          <button type="button" className="rl-arrow" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous piece">
            <Chevron dir="prev" />
          </button>
          <button type="button" className="rl-arrow" onClick={() => goTo(index + 1)} disabled={index === total - 1} aria-label="Next piece">
            <Chevron dir="next" />
          </button>
        </div>

        <ul className="rl-swatches" aria-label="Pieces on the rail">
          {pieces.map((p, i) => (
            <li key={p.key}>
              <button
                type="button"
                className="rl-swatch"
                style={colors[i] ? { '--sw': colors[i] } as React.CSSProperties : undefined}
                aria-label={`${pad(i + 1)}: ${p.title}`}
                aria-current={i === index || undefined}
                onClick={() => goTo(i)}
              />
            </li>
          ))}
        </ul>
      </div>

      {picked !== null && pieces[picked] && (
        <PieceSheet
          key={pieces[picked].key}
          piece={pieces[picked]}
          position={`${pad(picked + 1)} / ${pad(total)}`}
          takeFocus={sheetFocus}
          onClose={unpick}
        />
      )}
    </section>
  );
}
