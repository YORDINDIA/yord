'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { useActionForm } from '@/components/forms/ActionForm';
import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_FILES,
} from '@/lib/constants';
import { uploadMediaAction } from '@/server/actions/media';

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Drag-and-drop uploader.
 *
 * This used to call `supabase.storage.from('products').upload(...)` from the
 * browser with the anon key: the write bypassed `requireAdmin()` and left no
 * audit record. It now submits a real `<form action>` to `uploadMediaAction`,
 * which re-checks the same limits server-side and uploads with the service
 * client. The browser-side checks remain as fast feedback, not as the boundary.
 *
 * Drag-and-drop is routed through the file input (a DataTransfer is assigned to
 * `input.files`, then the form is submitted) so both paths hit one code path.
 */
export default function MediaUploader() {
  const router = useRouter();
  const { toast } = useToast();

  const { formAction, pending } = useActionForm<{ urls: string[] }>(uploadMediaAction, {
    // `useActionForm` already toasts the error and the success message.
    onResult: (result) => {
      if (result.status === 'success') router.refresh();
    },
  });

  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The server rejects batches over MAX_MEDIA_FILES outright, so the batch is
  // capped here — before submit — instead of sending files that are guaranteed
  // to fail. Both the picker and the drop path go through this. Returns true
  // when the input already holds the capped list.
  function capToLimit(files: FileList): boolean {
    const input = inputRef.current;
    if (!input || files.length <= MAX_MEDIA_FILES) return false;
    const capped = new DataTransfer();
    Array.from(files)
      .slice(0, MAX_MEDIA_FILES)
      .forEach((file) => capped.items.add(file));
    input.files = capped.files;
    toast(
      `Uploading the first ${MAX_MEDIA_FILES} images (${files.length} selected).`,
      'info',
    );
    return true;
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const input = inputRef.current;
    if (!input || event.dataTransfer.files.length === 0) return;
    if (!capToLimit(event.dataTransfer.files)) {
      input.files = event.dataTransfer.files;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <div>
      <div
        className="card"
        style={{
          borderStyle: 'dashed',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'rgba(243,177,63,0.12)' : undefined,
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload images"
        aria-busy={pending}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <div className="card-title">
          {pending ? 'Uploading…' : 'Drop images here or click to browse'}
        </div>
        <div className="helper">
          JPG, PNG, WebP · max {formatMb(MAX_MEDIA_BYTES)} each · up to {MAX_MEDIA_FILES} at once
        </div>
      </div>

      <form ref={formRef} action={formAction} style={{ display: 'none' }}>
        <input
          ref={inputRef}
          type="file"
          name="files"
          accept={ALLOWED_MEDIA_TYPES.join(',')}
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              capToLimit(e.target.files);
              formRef.current?.requestSubmit();
            }
            // Reset so re-picking the same file fires onChange again.
            e.target.value = '';
          }}
          aria-label="Choose images to upload"
        />
      </form>
    </div>
  );
}
