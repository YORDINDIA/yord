'use client';

import type { ReactNode } from 'react';
import BorderGlow from '@/components/reactbits/BorderGlow';
import { hexToHsl, useReactBitsColors } from '@/lib/reactbits-theme';
import styles from './login.module.css';

/**
 * The sign-in card: the form rides inside ReactBits' BorderGlow,
 * whose mesh-gradient border follows the cursor and whose outer glow
 * carries the accent hue. Colours resolve from the live tokens, so
 * each theme gets its own accent (saffron in dark, bronze in light),
 * and the surface is passed resolved because BorderGlow branches on
 * whether the card is light or dark.
 *
 * `styles.loginGlow` is the pre-hydration fallback: the resolved
 * surface is an empty string until the token store reads the
 * stylesheet, and an empty inline background does not override the
 * class, so the card is never transparent on the first paint.
 */
export default function LoginCard({ children }: { children: ReactNode }) {
  const colors = useReactBitsColors();

  return (
    <BorderGlow
      className={styles.loginGlow}
      backgroundColor={colors.surface}
      borderRadius={14}
      glowColor={hexToHsl(colors.accent)}
      glowRadius={26}
      glowIntensity={0.55}
      edgeSensitivity={42}
      colors={[colors.accent, colors.blue, colors.emerald]}
      fillOpacity={0.32}
    >
      <div className="stack" style={{ padding: 18 }}>
        {children}
      </div>
    </BorderGlow>
  );
}
