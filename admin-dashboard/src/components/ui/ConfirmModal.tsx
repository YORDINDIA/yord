"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  /** Plain text or richer nodes; rendered under the title. */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` repaints the confirm button as a destructive action. */
  tone?: "default" | "danger";
  /** Disables both buttons and relabels the confirm one while a write runs. */
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Extra content between the body and the actions (summary rows, warnings). */
  children?: ReactNode;
}

/**
 * Confirmation dialog for destructive writes (delete, refund, void).
 *
 * Behaviour is deliberate on three points:
 * - Focus starts on Cancel, so a stray Enter cannot fire the destructive path.
 *   While `pending` both buttons are disabled, so focus is held on the dialog
 *   itself instead of dropping out of the modal.
 * - Tab cycles inside the dialog (it is `aria-modal`, so focus must not escape
 *   to the page behind it).
 * - Escape and backdrop clicks close it, but never while `pending` — closing a
 *   request that is already in flight would hide its outcome.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  pending = false,
  onConfirm,
  onClose,
  children,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Escape closes; Tab cycles within the dialog. Both listen on `document` so
  // the trap still holds when focus sits on the dialog container itself.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!pending) onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, pending]);

  // Initial focus: Cancel while idle, the dialog while a write is running.
  useEffect(() => {
    if (!open) return;
    if (pending) dialogRef.current?.focus();
    else cancelRef.current?.focus();
  }, [open, pending]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={pending ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        className="card modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        {body ? <div className="helper">{body}</div> : null}
        {children}
        <div className="modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="button"
            onClick={onClose}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={clsx("button", tone === "danger" ? "danger" : "primary")}
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

export default ConfirmModal;
