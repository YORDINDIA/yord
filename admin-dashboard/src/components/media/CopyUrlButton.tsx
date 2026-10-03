"use client";

import clsx from 'clsx';
import { Copy } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Copy an asset's public URL to the clipboard.
 *
 * `className` and `showText` exist for the media library: a tile's hover
 * overlay needs the same button in its dense scrim styling, and the lightbox
 * needs a labelled variant. Both default to the original icon-only button, so
 * the products image grid renders it unchanged.
 */
export default function CopyUrlButton({
  url,
  label,
  className,
  showText = false,
}: {
  url: string;
  label?: string;
  /** Extra classes; the tile overlay passes its own scrim button style. */
  className?: string;
  /** Drops the fixed icon-button width and renders "Copy URL" next to the glyph. */
  showText?: boolean;
}) {
  const { toast } = useToast();
  // Speech input targets a control by its visible label, so the
  // accessible name keeps "Copy URL" verbatim before the asset name.
  const accessibleLabel = label ? `Copy URL for ${label}` : 'Copy public URL';

  return (
    <button
      type="button"
      className={clsx('button', showText ? 'small' : 'icon-button', className)}
      title={label ? `Copy ${label}` : 'Copy public URL'}
      aria-label={accessibleLabel}
      onClick={() => {
        navigator.clipboard.writeText(url).then(
          () => toast('URL copied.', 'success'),
          () => toast('Copy failed.', 'error'),
        );
      }}
    >
      <Copy size={14} aria-hidden="true" />
      {showText ? <span>Copy URL</span> : null}
    </button>
  );
}
