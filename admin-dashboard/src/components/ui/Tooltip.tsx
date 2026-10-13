"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./tooltip.module.css";

export interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}

/**
 * CSS-only tooltip. The bubble is a pseudo-element driven by `data-tip`, so
 * there is no state, no portal, and no measurement — it shows on hover and on
 * `:focus-within`, which is what makes it usable from the keyboard.
 *
 * Decorative by construction: the bubble is not in the accessibility tree, so
 * the wrapped control must keep its own `aria-label`/`title`.
 */
export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  return (
    // `tt` stays on the element as the stable hook the rest of the design
    // system was told about; `styles.tip` carries the bubble's CSS.
    <span className={clsx("tt", styles.tip)} data-tip={label} data-side={side}>
      {children}
    </span>
  );
}

export default Tooltip;
