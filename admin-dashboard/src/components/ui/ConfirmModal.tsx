"use client";

import { useEffect, useRef } from "react";

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Disables both buttons and relabels the confirm one while a write runs. */
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // Do not let Escape dismiss a modal whose action is still in flight; the
      // admin would lose the outcome of a write they just started.
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    // Move focus into the dialog so keyboard users are not left behind it.
    confirmRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={pending ? undefined : onClose} role="presentation">
      <div
        className="card modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-title">{title}</div>
        {body && <div className="helper">{body}</div>}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="button primary"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
