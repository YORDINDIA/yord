'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Copy-to-clipboard for one generated field.
 *
 * Icon-only by default (24px, `aria-label` required) so a copy control can sit
 * beside every artefact label without turning a panel into a rack of buttons;
 * pass `label` for the wide variant. Feedback is local — the glyph swaps to a
 * check for two seconds — rather than a toast per field, because copying five
 * fields in a row should not stack five toasts. Only the failure path toasts:
 * an unavailable clipboard needs an instruction ("select and copy manually"),
 * which a glyph cannot carry.
 */
export default function CopyButton({
  value,
  label,
  ariaLabel = 'Copy',
  disabled = false,
}: {
  /** Text written to the clipboard. Blank or missing renders nothing. */
  value: string | null | undefined;
  /** Visible button text. Omit for the icon-only variant. */
  label?: string;
  /** Accessible name — required for the icon-only variant. */
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // The clipboard receives the exact original string — generated HTML can
  // begin or end with meaningful whitespace. trim() only decides whether
  // there is anything to copy.
  const raw = value ?? '';
  if (!raw.trim()) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Clipboard unavailable — select the text and copy it manually.', 'error');
    }
  }

  const iconOnly = !label;

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      className={iconOnly ? 'button icon-button small' : 'button small'}
      aria-label={iconOnly ? ariaLabel : undefined}
      title={iconOnly ? ariaLabel : undefined}
    >
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {label && (copied ? 'Copied' : label)}
    </button>
  );
}
