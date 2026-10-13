'use client';

import Image from 'next/image';
import { useState } from 'react';
import clsx from 'clsx';
import { ExternalLink, ImagePlus, Star, Trash2 } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CopyUrlButton from '@/components/media/CopyUrlButton';
import { useActionForm } from '@/components/forms/ActionForm';
import { deleteProductImageAction, setCoverImageAction } from '@/server/actions/products';
import ImageLightbox from './ImageLightbox';
import styles from './products.module.css';

export type ProductImage = {
  id: number;
  product_id: number;
  position: number | null;
  storage_url: string | null;
  src: string | null;
  alt: string | null;
};

/**
 * Product image grid.
 *
 * Media tiles (`.media-tile` from globals.css) with hover/focus actions, a
 * cover badge on the first image, the display position on every tile, and
 * click-to-preview through a focus-trapped lightbox. Images render through
 * `next/image`; the cover promotion and the delete still go through the shared
 * product actions with the same `image_id` field, so `set_cover_image` and
 * `deleteProductImageAction` behave exactly as before.
 *
 * Reordering is not offered: the only ordering write path in the app is
 * `set_cover_image`, which promotes one image but does not accept a position
 * for the rest, and there is no reorder action to call. Move buttons would be
 * controls that cannot save.
 */
export default function ImageGrid({ images }: { images: ProductImage[] }) {
  const [pendingDelete, setPendingDelete] = useState<ProductImage | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const cover = useActionForm(setCoverImageAction);

  // A delete that succeeded or failed both close the dialog: on success the
  // tile is gone, on failure the toast carries the message.
  const remove = useActionForm(deleteProductImageAction, {
    onResult: () => setPendingDelete(null),
  });

  const previewImage = previewIndex === null ? null : images[previewIndex];
  const previewUrl = previewImage ? previewImage.storage_url ?? previewImage.src : null;

  if (images.length === 0) {
    return (
      <div className="media-grid">
        <div className={styles.tileEmpty}>
          <ImagePlus size={20} aria-hidden />
          <div className="helper">
            No images yet. Add one below — the first image becomes the cover.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="media-grid">
        {images.map((image, index) => {
          const isCover = index === 0;
          const url = image.storage_url ?? image.src;
          const alt = image.alt || `Product image ${index + 1}`;
          return (
            <div key={image.id} className="media-tile">
              <button
                type="button"
                className={styles.tilePreview}
                onClick={() => setPreviewIndex(index)}
                title="Preview image"
                aria-label={`Preview image ${index + 1} of ${images.length}`}
              >
                {url ? (
                  <Image
                    src={url}
                    alt={alt}
                    fill
                    sizes="(max-width: 767px) 45vw, 180px"
                  />
                ) : (
                  <span className="helper">No URL</span>
                )}
              </button>

              {isCover && (
                <span className="media-tile-badge">
                  <Star size={10} aria-hidden />
                  Cover
                </span>
              )}
              <span className={clsx('media-tile-badge', styles.tilePos)}>
                <span className="sr-only">Display position</span>#{index + 1}
              </span>

              <div className="media-tile-overlay">
                <div className="toolbar">
                  {!isCover && (
                    <form action={cover.formAction}>
                      <input type="hidden" name="image_id" value={image.id} />
                      <button
                        type="submit"
                        className="button icon-button"
                        title="Set as cover"
                        aria-label={`Set image ${index + 1} as cover`}
                        disabled={cover.pending}
                      >
                        <Star size={14} aria-hidden />
                      </button>
                    </form>
                  )}
                  {url && <CopyUrlButton url={url} label={`image ${index + 1}`} />}
                  {url && (
                    <a
                      className="button icon-button"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open full size in a new tab"
                      aria-label={`Open image ${index + 1} full size in a new tab`}
                    >
                      <ExternalLink size={14} aria-hidden />
                    </a>
                  )}
                  <button
                    type="button"
                    className="button icon-button"
                    title="Delete image"
                    aria-label={`Delete image ${index + 1}`}
                    onClick={() => setPendingDelete(image)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete image?"
        body="This removes the image from the product. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        pending={remove.pending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const fd = new FormData();
          fd.set('image_id', String(pendingDelete.id));
          remove.formAction(fd);
        }}
      />

      {previewImage && (
        <ImageLightbox
          label={`Image ${(previewIndex ?? 0) + 1} of ${images.length}`}
          src={previewUrl}
          alt={previewImage.alt || `Product image ${(previewIndex ?? 0) + 1}`}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}
