"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ImagePlus, Search, Trash2 } from "lucide-react";
import Thumb from "@/components/ui/Thumb";
import { displayableCoverUrl } from "@/lib/collection-list";
import type { MediaAsset } from "@/lib/data/media";
import styles from "./cover-picker.module.css";

/**
 * Cover field for the collection forms.
 *
 * Renders a hidden `storage_image_url` input (the column the storefront resolves
 * first), a live preview that falls back to the legacy `image_src` exactly the
 * way the storefront does, and a modal that picks from the media library.
 *
 * The assets come from the server page (an initial `listMediaAssets` window), so
 * picking needs no new API route and no middleware change — a cover is chosen
 * from a recent window, not paged through like the media library itself.
 */

type SourceFilter = "all" | MediaAsset["source"];

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "product", label: "Products" },
  { value: "article", label: "Articles" },
  { value: "upload", label: "Uploads" },
];

export interface CoverFieldProps {
  /** Server-provided window of library assets to pick from. */
  assets: MediaAsset[];
  /** Current `storage_image_url`; what the hidden input submits. */
  storageValue: string;
  /** Legacy `image_src`, shown as the preview fallback like the storefront. */
  legacyValue?: string;
  disabled?: boolean;
}

export default function CoverField({
  assets,
  storageValue,
  legacyValue = "",
  disabled = false,
}: CoverFieldProps) {
  const [value, setValue] = useState(storageValue);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");

  const preview = displayableCoverUrl(value, legacyValue);
  const previewLabel = preview === value.trim() && value.trim() ? "Library cover" : "Legacy image URL";

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter(
      (asset) =>
        (source === "all" || asset.source === source) &&
        (term === "" ||
          asset.name.toLowerCase().includes(term) ||
          asset.ownerLabel.toLowerCase().includes(term)),
    );
  }, [assets, search, source]);

  return (
    <div className={styles.field}>
      <input type="hidden" name="storage_image_url" value={value} />

      <div className={styles.previewRow}>
        <Thumb src={preview} alt="Collection cover preview" size="xl" />
        <div className={styles.previewMeta}>
          <span className="helper">
            {preview ? previewLabel : "No cover — the storefront falls back to its static hero."}
          </span>
          {preview ? (
            <span className={clsx(styles.url, "helper")} title={preview}>
              {preview}
            </span>
          ) : null}
        </div>
        <div className={styles.previewActions}>
          <button
            type="button"
            className="button"
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-haspopup="dialog"
          >
            <ImagePlus size={14} aria-hidden />
            Choose from library
          </button>
          {value ? (
            <button
              type="button"
              className="button"
              onClick={() => setValue("")}
              disabled={disabled}
            >
              <Trash2 size={14} aria-hidden />
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <CoverPickerModal
        open={open}
        assets={visible}
        total={assets.length}
        search={search}
        source={source}
        onSearch={setSearch}
        onSource={setSource}
        onPick={(url) => {
          setValue(url);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

interface CoverPickerModalProps {
  open: boolean;
  assets: MediaAsset[];
  /** Count before the search filter, for the "N of M" line. */
  total: number;
  search: string;
  source: SourceFilter;
  onSearch: (value: string) => void;
  onSource: (value: SourceFilter) => void;
  onPick: (url: string) => void;
  onClose: () => void;
}

function CoverPickerModal({
  open,
  assets,
  total,
  search,
  source,
  onSearch,
  onSource,
  onPick,
  onClose,
}: CoverPickerModalProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes; Tab cycles inside the dialog — the same contract as
  // ConfirmModal, so both modals in the app behave identically.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={clsx("card", "modal-card", styles.pickerCard)}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a cover from the media library"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="modal-title">Choose from library</h2>

        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <Search size={13} aria-hidden />
            <span className="sr-only">Search media by file name or owner</span>
            <input
              ref={searchRef}
              type="search"
              className="input"
              placeholder="File name or owner…"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
          <div className={styles.sourceButtons} role="group" aria-label="Filter by source">
            {SOURCE_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={clsx("button", source === option.value && styles.sourceActive)}
                aria-pressed={source === option.value}
                onClick={() => onSource(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="helper">
          {assets.length} of {total} assets · first {total} most recent
        </p>

        {assets.length === 0 ? (
          <p className="helper">Nothing matches. Clear the search or switch the source filter.</p>
        ) : (
          <div className={styles.grid}>
            {assets.map((asset) => (
              <button
                key={asset.key}
                type="button"
                className={styles.cell}
                title={`${asset.name} — ${asset.ownerLabel}`}
                onClick={() => onPick(asset.url)}
              >
                <Thumb src={asset.url} alt="" size="lg" />
                <span className={styles.cellMeta}>
                  <span className={styles.cellName}>{asset.name}</span>
                  <span className={styles.cellOwner}>{asset.ownerLabel}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
