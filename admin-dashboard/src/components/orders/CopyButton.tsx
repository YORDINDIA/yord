'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Copy-to-clipboard control for ids an admin pastes into Razorpay, a courier
 * portal, or the DB console.
 *
 * With `label` it is a normal button; without one it is a 24px icon-only button
 * that carries `aria-label` (and a matching tooltip via `title`, since the glyph
 * alone is not self-describing).
 */
export default function CopyButton({
  value,
  label,
  ariaLabel,
  toastMessage = 'Copied.',
  small = false,
}: {
  /** Text written to the clipboard. Blank or missing renders nothing. */
  value: string | null | undefined;
  /** Visible button text. Omit for the icon-only variant. */
  label?: string;
  /** Accessible name — required for the icon-only variant. */
  ariaLabel?: string;
  toastMessage?: string;
  small?: boolean;
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

  const text = (value ?? '').trim();
  if (!text) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast(toastMessage, 'success');
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Clipboard unavailable — select the value and copy it manually.', 'error');
    }
  }

  const iconOnly = !label;

  return (
    <button
      type="button"
      onClick={copy}
      className={
        iconOnly ? `button icon-button${small ? ' small' : ''}` : `button${small ? ' small' : ''}`
      }
      aria-label={iconOnly ? ariaLabel : undefined}
      title={iconOnly ? ariaLabel : undefined}
    >
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {label && (copied ? 'Copied' : label)}
    </button>
  );
}
