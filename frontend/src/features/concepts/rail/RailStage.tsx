'use client';

import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { RailScene } from './RailScene';

interface RailStageProps {
  textures: (string | null)[];
  /** Piece the rail opens on. Read once, when the scene is built. */
  start: number;
  motion: boolean;
  apiRef: RefObject<RailScene | null>;
  onIndex: (index: number) => void;
  onPick: (index: number) => void;
  onColors: (colors: (string | null)[]) => void;
  onReady: () => void;
  onFail: () => void;
}

/* Client-only (loaded through next/dynamic with ssr: false), so `three` is
   fetched only on this route. Owns the RailScene lifecycle; the hero talks to
   the scene through `apiRef`. */
export default function RailStage({ textures, start, motion, apiRef, ...cb }: RailStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onIndex = useEffectEvent(cb.onIndex);
  const onPick = useEffectEvent(cb.onPick);
  const onColors = useEffectEvent(cb.onColors);
  const onReady = useEffectEvent(cb.onReady);
  const onFail = useEffectEvent(cb.onFail);
  const initial = useEffectEvent(() => ({ motion, start }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Probe first: three.js logs an error for every context it fails to make.
    if (!document.createElement('canvas').getContext('webgl2')) {
      onFail();
      return;
    }
    let scene: RailScene;
    try {
      scene = new RailScene(
        host,
        textures,
        {
          onIndex: (i) => onIndex(i),
          onPick: (i) => onPick(i),
          onColors: (c) => onColors(c),
          onReady: () => onReady(),
          onFail: () => onFail(),
        },
        initial().motion,
        initial().start
      );
    } catch {
      // No WebGL: the DOM rail underneath stays as the page.
      onFail();
      return;
    }
    apiRef.current = scene;
    return () => {
      scene.dispose();
      apiRef.current = null;
    };
  }, [textures, apiRef]);

  useEffect(() => {
    apiRef.current?.setMotion(motion);
  }, [motion, apiRef]);

  return <div ref={hostRef} className="rl-stage__gl" />;
}
