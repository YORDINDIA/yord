'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Trash2, Star } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CopyUrlButton from '@/components/media/CopyUrlButton';
import { useActionForm } from '@/components/forms/ActionForm';
import {
  deleteProductImageAction,
  setCoverImageAction,
} from '@/server/actions/products';

export type ProductImage = {
  id: number;
  product_id: number;
  position: number | null;
  supabase_url: string | null;
  src: string | null;
  alt: string | null;
};

/**
 * Product image grid with copy / set-cover / delete.
 *
 * Images render through `next/image` (previously `<img>` with an
 * eslint-disable), and every icon button carries an `aria-label`. The cover
 * promotion and delete go through the shared product actions, so a failed write
 * reports itself instead of re-rendering unchanged.
 */
export default function ImageGrid({ images }: { images: ProductImage[] }) {
  const [pendingDelete, setPendingDelete] = useState<ProductImage | null>(null);

  // `useActionForm` already toasts errors; a failed delete also closes the modal.
  const cover = useActionForm(setCoverImageAction);

  const remove = useActionForm(deleteProductImageAction, {
    onResult: (result) => {
      if (result.status === 'error') setPendingDelete(null);
    },
  });

  return (
    <>
      <div className="media-grid">
        {images.map((image, index) => {
          const isCover = index === 0;
          const url = image.supabase_url ?? image.src;
          return (
            <div key={image.id} className="card media-card" style={{ padding: 12 }}>
              {url && (
                <Image
                  src={url}
                  // Alt text is admin-authored and often missing; fall back to a
                  // descriptive string rather than an empty alt.
                  alt={image.alt || `Product image ${image.id}`}
                  width={320}
                  height={320}
                  sizes="(max-width: 768px) 50vw, 180px"
                  style={{ width: '100%', height: 'auto', borderRadius: 12 }}
                />
              )}
              <div className="helper" style={{ marginTop: 8 }}>
                {isCover ? 'Cover · ' : ''}
                {image.alt || 'No alt text'}
              </div>
              <div className="toolbar" style={{ marginTop: 8 }}>
                {url && <CopyUrlButton url={url} label={`image ${image.id}`} />}
                {!isCover && (
                  <form action={cover.formAction}>
                    <input type="hidden" name="image_id" value={image.id} />
                    <button
                      type="submit"
                      className="button icon-button"
                      title="Set as cover"
                      aria-label={`Set image ${image.id} as cover`}
                      disabled={cover.pending}
                    >
                      <Star size={14} />
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  className="button icon-button"
                  title="Delete image"
                  aria-label={`Delete image ${image.id}`}
                  onClick={() => setPendingDelete(image)}
                >
                  <Trash2 size={14} />
                </button>
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
        pending={remove.pending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const fd = new FormData();
          fd.set('image_id', String(pendingDelete.id));
          remove.formAction(fd);
        }}
      />
    </>
  );
}
