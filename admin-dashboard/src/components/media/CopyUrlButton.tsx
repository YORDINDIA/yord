"use client";

import { Copy } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export default function CopyUrlButton({ url, label }: { url: string; label?: string }) {
  const { toast } = useToast();

  return (
    <button
      type="button"
      className="button icon-button"
      title={label ? `Copy ${label}` : 'Copy public URL'}
      aria-label={label ? `Copy ${label} URL` : 'Copy public URL'}
      onClick={() => {
        navigator.clipboard.writeText(url).then(
          () => toast("URL copied.", "success"),
          () => toast("Copy failed.", "error"),
        );
      }}
    >
      <Copy size={14} />
    </button>
  );
}
