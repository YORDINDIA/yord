'use client';

import { Copy } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Icon-only "copy the email" button for the customer header.
 *
 * The clipboard API rejects when the document is not focused or the permission
 * is denied, so the failure path reports it instead of silently doing nothing —
 * which is exactly what the admin would otherwise see: a click, and no change.
 * The toast is the only feedback channel (no local "copied" state to drift).
 */
export default function CopyEmailButton({ email }: { email: string | null | undefined }) {
  const { toast } = useToast();
  const value = email?.trim();

  async function onCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast('Email address copied.', 'success');
    } catch {
      toast('Could not copy the email — select it and copy manually.', 'error');
    }
  }

  return (
    <button
      type="button"
      className="button icon-button"
      onClick={onCopy}
      disabled={!value}
      aria-label="Copy email address"
      title="Copy email address"
    >
      <Copy size={14} aria-hidden />
    </button>
  );
}
