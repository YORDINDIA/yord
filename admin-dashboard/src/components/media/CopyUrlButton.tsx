"use client";

import { Copy } from "lucide-react";
import { toast } from "@/components/ui/Toast";

export default function CopyUrlButton({ url }: { url: string }) {
  return (
    <button
      type="button"
      className="button icon-button"
      title="Copy public URL"
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
