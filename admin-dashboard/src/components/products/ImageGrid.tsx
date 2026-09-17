"use client";

import { useState } from "react";
import { Copy, Trash2, Star } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { toast } from "@/components/ui/Toast";

export type ProductImage = { id: number; supabase_url: string | null; alt: string | null };

export default function ImageGrid({
  images,
  onDelete,
  onSetCover,
}: {
  images: ProductImage[];
  onDelete: (formData: FormData) => void;
  onSetCover: (formData: FormData) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<ProductImage | null>(null);

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast("Image URL copied.", "success"),
      () => toast("Copy failed.", "error"),
    );
  }

  return (
    <>
      <div className="media-grid">
        {images.map((image, idx) => (
          <div key={image.id} className="card media-card" style={{ padding: 12 }}>
            {image.supabase_url && (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview, no LCP budget
              <img src={image.supabase_url} alt={image.alt || ""} loading="lazy" />
            )}
            <div className="helper" style={{ marginTop: 8 }}>
              {idx === 0 ? "Cover · " : ""}
              {image.alt || "No alt text"}
            </div>
            <div className="toolbar" style={{ marginTop: 8 }}>
              {image.supabase_url && (
                <button type="button" className="button icon-button" title="Copy URL" onClick={() => copyUrl(image.supabase_url!)}>
                  <Copy size={14} />
                </button>
              )}
              {idx !== 0 && (
                <form action={onSetCover}>
                  <input type="hidden" name="image_id" value={image.id} />
                  <button type="submit" className="button icon-button" title="Set as cover">
                    <Star size={14} />
                  </button>
                </form>
              )}
              <button
                type="button"
                className="button icon-button"
                title="Delete image"
                onClick={() => setPendingDelete(image)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete image?"
        body="This removes the image from the product. This cannot be undone."
        confirmLabel="Delete"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const fd = new FormData();
          fd.set("image_id", String(pendingDelete.id));
          onDelete(fd);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
