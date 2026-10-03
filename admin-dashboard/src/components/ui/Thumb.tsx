import clsx from "clsx";
import { ImageIcon, type LucideIcon } from "lucide-react";
import Image from "next/image";

/** Box size in px, used to scale the fallback glyph and as the
 *  `sizes` hint (matching the rendered box keeps browsers on the
 *  smallest adequate variant). */
const SIZE_PX = { sm: 26, md: 34, lg: 48, xl: 64 } as const;

/**
 * `next/image` remote patterns allow HTTPS only (next.config.ts), and legacy
 * rows still hold http:// cover URLs, which would throw at render. Upgrade
 * the scheme; anything that still is not an HTTPS URL (or does not parse)
 * renders the fallback glyph instead of an error.
 */
function toRenderableUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  if (parsed.protocol === "http:") parsed.protocol = "https:";
  return parsed.protocol === "https:" ? parsed.toString() : "";
}

export interface ThumbProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallbackIcon?: LucideIcon;
}

/**
 * Table/cell thumbnail. Server-safe by design: there is no `onError`, so a URL
 * that 404s leaves the neutral `.thumb` background visible behind the image
 * instead of flipping the component into a client boundary. A missing, blank
 * or unsupported `src` renders the fallback glyph, which is the common case
 * (products and articles migrated from Shopify often have no image).
 *
 * `fill` needs a positioned parent — `.thumb` is `position: relative` with a
 * fixed box, so the image never reflows the row.
 */
export function Thumb({
  src,
  alt = "",
  size = "md",
  fallbackIcon: Fallback = ImageIcon,
}: ThumbProps) {
  const url = typeof src === "string" ? toRenderableUrl(src.trim()) : "";
  const className = clsx("thumb", size !== "md" && `thumb-${size}`);

  if (url) {
    return (
      <span className={className}>
        <Image src={url} alt={alt} fill sizes={`${SIZE_PX[size]}px`} />
      </span>
    );
  }

  return (
    <span className={className}>
      <Fallback size={Math.round(SIZE_PX[size] * 0.42)} aria-hidden="true" />
    </span>
  );
}

export default Thumb;
