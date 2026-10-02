import clsx from "clsx";
import { ImageIcon, type LucideIcon } from "lucide-react";
import Image from "next/image";

/** Box size in px, used only to scale the fallback glyph to the box. */
const SIZE_PX = { sm: 26, md: 34, lg: 48, xl: 64 } as const;

export interface ThumbProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallbackIcon?: LucideIcon;
}

/**
 * Table/cell thumbnail. Server-safe by design: there is no `onError`, so a URL
 * that 404s leaves the neutral `.thumb` background visible behind the image
 * instead of flipping the component into a client boundary. A missing or blank
 * `src` renders the fallback glyph, which is the common case (products and
 * articles migrated from Shopify often have no image).
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
  const url = typeof src === "string" ? src.trim() : "";
  const className = clsx("thumb", size !== "md" && `thumb-${size}`);

  if (url) {
    return (
      <span className={className}>
        <Image src={url} alt={alt} fill sizes="64px" />
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
