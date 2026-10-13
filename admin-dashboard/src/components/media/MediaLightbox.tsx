'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import type { MediaAsset } from '@/lib/data/media';
import { formatDate } from '@/lib/utils/format';
import CopyUrlButton from './CopyUrlButton';
import { formatBytes, formatDimensions, mimeTypeFromUrl, sourceLabel } from './display';
import styles from './media.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Full-size asset viewer: Escape closes, arrow keys move between the assets of
 * the current page, Tab cycles inside the dialog.
 *
 * Written as a local dialog rather than a change to `ConfirmModal`: that
 * component is a two-button confirmation and is owned elsewhere. The focus
 * trap, the Escape handling and the backdrop click follow its behaviour
 * deliberately, so the two read the same way — plus two things a viewer needs
 * and a confirm dialog does not: arrow-key paging and a body scroll lock.
 *
 * The byte size is best-effort: nothing stores it, so one `HEAD` request is
 * made when an asset opens and "—" is shown if the bucket refuses to answer
 * (cross-origin `Content-Length` is not guaranteed). Dimensions come from the
 * stored row first and from the decoded image second.
 */
export default function MediaLightbox({
  assets,
  index,
  onClose,
  onIndexChange,
}: {
  /** The assets of the page behind the dialog — the set the arrows move through. */
  assets: MediaAsset[];
  /** `null` closes the dialog. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [sizeUrl, setSizeUrl] = useState<string | null>(null);
  const [reportedSize, setReportedSize] = useState<number | null>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const open = index !== null && index >= 0 && index < assets.length;
  const asset = open ? assets[index as number] : null;
  const url = asset?.url ?? null;
  const previous = open && (index as number) > 0;
  const next = open && (index as number) < assets.length - 1;

  // A new asset resets everything derived from the old one. Adjusted during
  // render, keyed on the URL the values belong to (`SearchInput`'s pattern):
  // the effect form is a lint error here and would repaint the previous asset's
  // size under the new image.
  if (sizeUrl !== url) {
    setSizeUrl(url);
    setReportedSize(null);
    setMeasured(null);
  }

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { method: 'HEAD', signal: controller.signal })
      .then((response) => {
        const header = response.headers.get('content-length');
        const bytes = header ? Number(header) : Number.NaN;
        if (Number.isFinite(bytes) && bytes > 0) setReportedSize(bytes);
      })
      .catch(() => {
        // No CORS on the bucket, or offline: the row shows "—".
      });
    return () => controller.abort();
  }, [url]);

  // Escape closes, arrows page, Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' && previous) {
        event.preventDefault();
        onIndexChange((index as number) - 1);
        return;
      }
      if (event.key === 'ArrowRight' && next) {
        event.preventDefault();
        onIndexChange((index as number) + 1);
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
  }, [open, onClose, onIndexChange, index, previous, next]);

  // Focus starts on Close so a stray Enter cannot open a full-size image tab.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // The dialog owns the viewport; let the page behind it scroll again on close.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!asset) return null;

  const mime = mimeTypeFromUrl(asset.url);
  const width = asset.width ?? measured?.width ?? null;
  const height = asset.height ?? measured?.height ?? null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={clsx('card modal-card', styles.lightbox)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.lightboxHeader}>
          <span className="chip tone tone-rose">{sourceLabel(asset.source)}</span>
          <span id={titleId} className={clsx('card-title', 'truncate')} title={asset.name}>
            {asset.name}
          </span>
          <span className="helper nowrap">
            {(index as number) + 1} of {assets.length}
          </span>
          <span className="spacer" />
          <button
            ref={closeRef}
            type="button"
            className="button icon-button"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.lightboxBody}>
          <div className={styles.lightboxStage}>
            <button
              type="button"
              className={clsx('button', styles.lightboxNav)}
              onClick={() => onIndexChange((index as number) - 1)}
              disabled={!previous}
              aria-label="Previous asset"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <div className={styles.stageImage}>
              <Image
                src={asset.url}
                alt={asset.alt ?? asset.name}
                fill
                sizes="(max-width: 900px) 100vw, 70vw"
                className={styles.lightboxImage}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (image.naturalWidth > 0) {
                    setMeasured({ width: image.naturalWidth, height: image.naturalHeight });
                  }
                }}
              />
            </div>
            <button
              type="button"
              className={clsx('button', styles.lightboxNav)}
              onClick={() => onIndexChange((index as number) + 1)}
              disabled={!next}
              aria-label="Next asset"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Used by</span>
              {asset.ownerHref ? (
                <Link className={styles.metaValue} href={asset.ownerHref}>
                  {asset.ownerLabel}
                </Link>
              ) : (
                <span className={styles.metaValue}>{asset.ownerLabel}</span>
              )}
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Dimensions</span>
              <span className={styles.metaValue}>
                {formatDimensions(width, height)}
                {asset.width === null && measured ? ' (measured on load)' : ''}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Size</span>
              <span className={styles.metaValue} title="Read from the object's Content-Length when the bucket returns it.">
                {reportedSize === null ? '—' : formatBytes(reportedSize)}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Type</span>
              <span className={styles.metaValue}>
                {mime.type}
                {mime.known ? '' : ' (not recognised from the file name)'}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Added</span>
              <span className={styles.metaValue}>{formatDate(asset.createdAt)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Alt text</span>
              <span className={styles.metaValue}>
                {asset.alt ? asset.alt : 'None recorded'}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Public URL</span>
              <div className={styles.urlBox}>{asset.url}</div>
            </div>
            <div className="row">
              <CopyUrlButton url={asset.url} label={asset.name} showText />
              <a className="button small" href={asset.url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden="true" />
                Open full size
              </a>
            </div>
          </div>
        </div>

        <div className={styles.strip}>
          {assets.map((item, itemIndex) => (
            <button
              key={item.key}
              type="button"
              className={clsx(styles.stripItem, itemIndex === index && styles.stripItemActive)}
              onClick={() => onIndexChange(itemIndex)}
              aria-label={`Show ${item.name}`}
              aria-current={itemIndex === index ? 'true' : undefined}
              title={item.name}
            >
              {/* The bucket already holds one web-optimized variant per image,
                  so the strip skips the Next image optimizer: 40 tiles should
                  not become 40 optimizer invocations when the dialog opens. */}
              <Image src={item.url} alt="" fill sizes="40px" unoptimized loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
