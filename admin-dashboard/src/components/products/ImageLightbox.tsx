'use client';

import { useEffect, useId, useRef } from 'react';
import Image from 'next/image';
import { ImageOff, X } from 'lucide-react';
import styles from './products.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Click-to-preview dialog for a product image.
 *
 * Same contract as `ConfirmModal`: `aria-modal`, focus starts on the dialog,
 * Tab cycles inside it, Escape and a backdrop click close it. Kept local
 * (rather than reusing `ConfirmModal`) because a preview has no confirm action
 * — a dialog whose primary button pretends to "confirm" nothing is worse than
 * a small purpose-built one.
 */
export default function ImageLightbox({
  label,
  src,
  alt,
  onClose,
}: {
  /** Dialog title, e.g. "Image 2 of 5". */
  label: string;
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

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
      // Focus starts on the dialog itself. `contains` counts it as
      // inside, but it is neither `first` nor `last`, so without this
      // boundary Shift+Tab falls through to the page behind the modal.
      if (active === dialog) {
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

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.lightbox}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row-between">
          <h2 id={titleId} className="modal-title">
            {label}
          </h2>
          <button
            type="button"
            className="button icon-button"
            onClick={onClose}
            aria-label="Close image preview"
            title="Close preview"
          >
            <X size={14} aria-hidden />
          </button>
        </div>

        {src ? (
          <Image
            src={src}
            alt={alt}
            width={1400}
            height={1400}
            sizes="(max-width: 767px) 92vw, 720px"
            className={styles.lightboxImage}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <ImageOff size={20} aria-hidden />
            </div>
            <div className="empty-title">No image URL</div>
            <div className="empty-hint">
              This row has neither a storage URL nor a source URL, so there is nothing to show.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
