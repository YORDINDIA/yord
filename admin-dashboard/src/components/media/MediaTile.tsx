'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useState } from 'react';
import { ExternalLink, ImageOff, Trash2 } from 'lucide-react';
import type { MediaAsset } from '@/lib/data/media';
import CopyUrlButton from './CopyUrlButton';
import { sourceLabel } from './display';
import styles from './media.module.css';

/**
 * One square tile in the media grid: the image, its source badge, a selection
 * box, and the hover overlay (copy URL, open full size, delete).
 *
 * `next/image` is given `fill`, so `.media-tile` supplies the square box; the
 * caption sits *under* the tile rather than inside it, because the tile's
 * aspect ratio is fixed by globals.css. A URL that 404s (deleted R2 object)
 * swaps to an explicit "Image unavailable" state instead of leaving a blank
 * square that looks like a slow load.
 */
export default function MediaTile({
  asset,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  asset: MediaAsset;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <div className={styles.tileWrap}>
      <div className={clsx('media-tile', selected && styles.tileSelected)}>
        <button
          type="button"
          className={styles.imageButton}
          onClick={onOpen}
          aria-label={`Preview ${asset.name}`}
        >
          {broken ? (
            <span className={styles.broken}>
              <ImageOff size={16} aria-hidden="true" />
              Image unavailable
            </span>
          ) : (
            <Image
              src={asset.url}
              alt={asset.alt ?? ''}
              fill
              sizes="(max-width: 767px) 30vw, 160px"
              onError={() => setBroken(true)}
            />
          )}
        </button>

        <span className="media-tile-badge">{sourceLabel(asset.source)}</span>

        <span className={styles.select}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${asset.name}`}
          />
        </span>

        <div className={clsx('media-tile-overlay', styles.overlay, styles.overlayForce)}>
          <span className={styles.overlayName} title={asset.name}>
            {asset.name}
          </span>
          <span className={styles.overlayActions}>
            <CopyUrlButton
              url={asset.url}
              label={asset.name}
              className={styles.overlayButton}
            />
            <a
              className={styles.overlayButton}
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              title="Open full size in a new tab"
              aria-label={`Open ${asset.name} in a new tab`}
            >
              <ExternalLink size={14} aria-hidden="true" />
            </a>
            <button
              type="button"
              className={clsx(styles.overlayButton, styles.overlayButtonDanger)}
              onClick={onDelete}
              title="Delete this asset"
              aria-label={`Delete ${asset.name}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>

      <div className={styles.caption} title={`${asset.name} — ${asset.ownerLabel}`}>
        {asset.name}
      </div>
    </div>
  );
}
