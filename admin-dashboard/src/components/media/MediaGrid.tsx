'use client';

import { useMemo, useState } from 'react';
import BulkActions from '@/components/data/BulkActions';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/ToastProvider';
import type { MediaAsset } from '@/lib/data/media';
import MediaLightbox from './MediaLightbox';
import MediaTile from './MediaTile';
import { MEDIA_DELETE_UNAVAILABLE } from './display';

/**
 * The interactive half of the media library: tile selection, the bulk bar, the
 * full-size viewer, and the delete confirmation.
 *
 * Delete deliberately does not pretend. `src/server/actions/media.ts` only
 * uploads — there is no action that removes an R2 object or its row, and this
 * page may not write to storage or the database itself — so the confirmation
 * dialog explains exactly that and confirming only reports it. The flow, the
 * focus trap and the danger styling are all real; the write path is the one
 * missing piece, and `MEDIA_DELETE_UNAVAILABLE` in `display.ts` is the single
 * string to replace when it lands.
 *
 * Selection is reset when the page's assets change (a new page, filter, sort or
 * search). It is keyed on a signature string rather than an effect, the same
 * pattern `SearchInput` uses: adjusting state during render means the grid can
 * never show ticks for assets that are no longer on screen, and there is no
 * flash of the previous page's selection.
 */
export default function MediaGrid({ assets }: { assets: MediaAsset[] }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaAsset[] | null>(null);

  const signature = useMemo(() => assets.map((asset) => asset.key).join('|'), [assets]);
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setSelected([]);
    setOpenIndex(null);
  }

  const selectedAssets = assets.filter((asset) => selected.includes(asset.key));
  const allSelected = assets.length > 0 && selected.length === assets.length;

  function toggle(key: string) {
    setSelected((previous) =>
      previous.includes(key) ? previous.filter((entry) => entry !== key) : [...previous, key],
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : assets.map((asset) => asset.key));
  }

  return (
    <>
      <BulkActions
        action={() => {
          setPendingDelete(selectedAssets);
        }}
        selected={selected}
        label="Media:"
      >
        <button className="button small" type="button" onClick={toggleAll}>
          {allSelected ? 'Clear selection' : 'Select page'}
        </button>
        <button
          className="button small danger"
          type="submit"
          disabled={selected.length === 0}
        >
          Delete selected
        </button>
      </BulkActions>

      <div className="media-grid">
        {assets.map((asset, index) => (
          <MediaTile
            key={asset.key}
            asset={asset}
            selected={selected.includes(asset.key)}
            onToggle={() => toggle(asset.key)}
            onOpen={() => setOpenIndex(index)}
            onDelete={() => setPendingDelete([asset])}
          />
        ))}
      </div>

      <MediaLightbox
        assets={assets}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        tone="danger"
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} assets?`
            : 'Delete this asset?'
        }
        confirmLabel="Delete"
        body="Deleting media has no server action yet, so this dialog cannot remove anything — neither the file in the bucket nor the row that points at it. Nothing will change."
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          setPendingDelete(null);
          toast(MEDIA_DELETE_UNAVAILABLE, 'error');
        }}
      >
        {pendingDelete && pendingDelete.length > 0 ? (
          <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {pendingDelete.slice(0, 5).map((asset) => (
              <li key={asset.key} className="helper truncate" title={asset.url}>
                {asset.name}
              </li>
            ))}
            {pendingDelete.length > 5 ? (
              <li className="helper">…and {pendingDelete.length - 5} more</li>
            ) : null}
          </ul>
        ) : null}
      </ConfirmModal>
    </>
  );
}
