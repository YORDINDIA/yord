'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { RotateCcw, UploadCloud, X } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';
import { useToast } from '@/components/ui/ToastProvider';
import { INITIAL_ACTION_STATE } from '@/lib/action-state';
import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_BYTES, MAX_MEDIA_FILES, isOneOf } from '@/lib/constants';
import { VARIANT_QUALITY, variantDimensions, variantFileName } from '@/lib/image-variant';
import { uploadMediaAction } from '@/server/actions/media';
import { formatBytes } from '@/components/media/display';
import styles from '@/components/media/media.module.css';

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Convert one file to the WebP variant the bucket stores.
 *
 * Unchanged from the previous uploader — the same helper, the same quality and
 * the same 1600px cap — so the bytes that reach `uploadMediaAction` are the
 * same bytes the R2 pipeline has always received.
 *
 * Returns the original file when the browser cannot decode it (HEIC in some
 * browsers) or cannot encode WebP — the server accepts JPEG/PNG/WebP, so an
 * unconverted fallback still uploads, just larger.
 */
async function convertToWebp(file: File): Promise<File> {
  if (file.type === 'image/webp') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = variantDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', VARIANT_QUALITY),
    );
    // Browsers without a WebP encoder quietly hand back a PNG instead.
    if (!blob || blob.type !== 'image/webp') return file;
    return new File([blob], variantFileName(file.name), { type: 'image/webp' });
  } catch {
    return file;
  }
}

type QueueStatus = 'queued' | 'optimizing' | 'uploading' | 'done' | 'failed';

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: QueueStatus;
  /** Why it failed: a client-side check, or the action's own message. */
  error?: string;
  /** Public URL the action returned, for a successful upload. */
  url?: string;
}

let nextId = 0;

/** Status chip copy, tone and colour per queue state. */
const STATUS_LABEL: Record<QueueStatus, string> = {
  queued: 'Queued',
  optimizing: 'Optimizing…',
  uploading: 'Uploading…',
  done: 'Uploaded',
  failed: 'Failed',
};

const STATUS_TONE: Record<QueueStatus, string> = {
  queued: '',
  optimizing: 'tone tone-blue',
  uploading: 'tone tone-blue',
  done: 'tone tone-emerald',
  failed: 'tone tone-rose',
};

/**
 * Drag-and-drop uploader with a per-file queue.
 *
 * The transport is untouched: each file still goes to `uploadMediaAction` as a
 * WebP variant in a `files` FormData entry, uploaded to Cloudflare R2 after the
 * action's own admin check. What changed is the shape of the submission — one
 * file per action call, run sequentially — which is what makes a real per-file
 * state possible ("queued → optimizing → uploading → done/failed") and a real
 * per-file retry. A single batch submission cannot do either: the action
 * reports failures by folding them into one message string, and a Server Action
 * exposes no upload progress events.
 *
 * The queue cap per drop (`MAX_MEDIA_FILES`) and every client-side check are
 * the same fast feedback as before; the server re-checks all of them.
 */
export default function MediaUploader() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mirrors `items` so the upload loop reads the current queue without waiting
  // for a render, and so a retry enqueued mid-run is picked up by that run.
  const itemsRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(false);

  const commit = useCallback((next: QueueItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<QueueItem>) => {
      commit(itemsRef.current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    },
    [commit],
  );

  /** Upload queued rows one at a time; a second call while running is a no-op. */
  async function pump() {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    let uploaded = 0;
    let failed = 0;

    try {
      for (;;) {
        const next = itemsRef.current.find((item) => item.status === 'queued');
        if (!next) break;

        patch(next.id, { status: 'optimizing', error: undefined });
        try {
          const variant = await convertToWebp(next.file);
          patch(next.id, { status: 'uploading' });
          const formData = new FormData();
          formData.append('files', variant, variant.name);
          const result = await uploadMediaAction(INITIAL_ACTION_STATE, formData);

          if (result.status === 'success') {
            uploaded += 1;
            patch(next.id, { status: 'done', url: result.data?.urls?.[0] });
          } else {
            failed += 1;
            patch(next.id, {
              status: 'failed',
              error: result.formError ?? 'The server rejected this file.',
            });
          }
        } catch {
          failed += 1;
          patch(next.id, { status: 'failed', error: 'The upload did not complete.' });
        }
      }
    } finally {
      runningRef.current = false;
      setBusy(false);
      if (uploaded > 0) router.refresh();
      if (uploaded > 0 && failed === 0) {
        toast(`Uploaded ${uploaded} image${uploaded === 1 ? '' : 's'}.`, 'success');
      } else if (uploaded > 0) {
        toast(`Uploaded ${uploaded}, ${failed} failed. Retry the failed rows.`, 'info');
      } else if (failed > 0) {
        toast(`Upload failed for ${failed} image${failed === 1 ? '' : 's'}.`, 'error');
      }
    }
  }

  /** Client-side fast feedback; the action enforces the same limits again. */
  function validate(file: File): string | null {
    if (!isOneOf(ALLOWED_MEDIA_TYPES, file.type)) {
      return 'Only JPG, PNG, and WebP are accepted.';
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return `${formatBytes(file.size)} — over the ${formatMb(MAX_MEDIA_BYTES)} limit.`;
    }
    return null;
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (files.length > MAX_MEDIA_FILES) {
      toast(
        `Queued the first ${MAX_MEDIA_FILES} images (${files.length} selected).`,
        'info',
      );
    }
    const queued: QueueItem[] = files.slice(0, MAX_MEDIA_FILES).map((file) => {
      nextId += 1;
      const item: QueueItem = {
        id: `upload-${nextId}`,
        file,
        name: file.name,
        size: file.size,
        status: 'queued',
      };
      const problem = validate(file);
      return problem ? { ...item, status: 'failed', error: problem } : item;
    });

    commit([...itemsRef.current, ...queued]);
    void pump();
  }

  function retry(id: string) {
    patch(id, { status: 'queued', error: undefined });
    void pump();
  }

  function dismiss(id: string) {
    commit(itemsRef.current.filter((item) => item.id !== id));
  }

  function clearFinished() {
    commit(itemsRef.current.filter((item) => item.status !== 'done' && item.status !== 'failed'));
  }

  const finished = items.filter((item) => item.status === 'done' || item.status === 'failed').length;
  const uploadedCount = items.filter((item) => item.status === 'done').length;
  const active = items.find((item) => item.status === 'optimizing' || item.status === 'uploading');
  const label = busy
    ? active
      ? `Uploading ${active.name}…`
      : 'Uploading…'
    : 'Drop images here or click to browse';

  return (
    <div>
      <div
        className={styles.uploadZone}
        data-drag={dragOver ? 'true' : undefined}
        role="button"
        tabIndex={0}
        aria-label="Upload images: drop files here or activate to browse"
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
        }}
      >
        <span className={styles.uploadIcon}>
          <UploadCloud size={16} aria-hidden="true" />
        </span>
        <div>
          <div className="card-title">{label}</div>
          <div className="helper">
            JPG, PNG, WebP · max {formatMb(MAX_MEDIA_BYTES)} each · up to {MAX_MEDIA_FILES} per drop
            · converted to WebP, max 1600px wide
          </div>
        </div>
        <span className="spacer" />
        {/* Decorative: the zone is the control, so this is not a second tab stop.
            `styles.zoneCta` keeps it from being squeezed on narrow screens,
            where the flex neighbour's helper text grows. */}
        <span className={`button small ${styles.zoneCta}`}>Browse files</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="files"
        accept={ALLOWED_MEDIA_TYPES.join(',')}
        multiple
        style={{ display: 'none' }}
        aria-label="Choose images to upload"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) addFiles(event.target.files);
          // Reset so re-picking the same file fires onChange again.
          event.target.value = '';
        }}
      />

      {items.length > 0 ? (
        <div className={styles.queue}>
          <div className="row-between">
            <span className="helper">
              {uploadedCount} of {items.length} uploaded
              {items.some((item) => item.status === 'failed')
                ? ` · ${items.filter((item) => item.status === 'failed').length} failed`
                : ''}
            </span>
            <span className="row">
              <button
                className="button small"
                type="button"
                onClick={clearFinished}
                disabled={finished === 0}
              >
                Clear finished
              </button>
            </span>
          </div>

          {busy ? (
            <ProgressBar
              value={finished}
              max={items.length}
              size="sm"
              tone="rose"
              label="Batch progress"
            />
          ) : null}

          {items.map((item) => (
            <div className={styles.queueRow} key={item.id}>
              <span className={styles.queueName} title={item.name}>
                {item.name}
              </span>
              <span className="row">
                <span className={styles.queueMeta}>{formatBytes(item.size)}</span>
                <span className={clsx('chip', STATUS_TONE[item.status])}>
                  {STATUS_LABEL[item.status]}
                </span>
                {item.status === 'failed' ? (
                  <button
                    type="button"
                    className="button small"
                    onClick={() => retry(item.id)}
                    aria-label={`Retry ${item.name}`}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Retry
                  </button>
                ) : null}
                {item.status === 'done' || item.status === 'failed' ? (
                  <button
                    type="button"
                    className="button small icon-button"
                    onClick={() => dismiss(item.id)}
                    aria-label={`Remove ${item.name} from the queue`}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </span>

              {item.status === 'optimizing' || item.status === 'uploading' ? (
                <span className={styles.bar}>
                  <span className={styles.barFill} />
                </span>
              ) : null}
              {item.status === 'done' ? <span className={styles.barDone} /> : null}
              {item.status === 'failed' ? (
                <>
                  <span className={styles.barFailed} />
                  <span className={styles.queueError} role="alert">
                    {item.error}
                  </span>
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
