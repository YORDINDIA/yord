"use client";

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10_000_000;

export default function MediaUploader() {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setLoading(true);
    const urls: string[] = [];
    for (const file of list.slice(0, 10)) {
      if (!ALLOWED_TYPES.has(file.type)) {
        toast(`${file.name}: only JPG, PNG, WebP allowed.`, 'error');
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast(`${file.name}: max 10 MB.`, 'error');
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'bin';
      const path = `admin/${crypto.randomUUID()}.${safeExt}`;
      const { error } = await supabase.storage.from('products').upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) {
        toast(`${file.name}: ${error.message}`, 'error');
      } else {
        const { data } = supabase.storage.from('products').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setLoading(false);
    if (urls.length > 0) {
      setDone(urls);
      toast(`${urls.length} image${urls.length === 1 ? '' : 's'} uploaded.`, 'success');
      router.refresh();
    }
  }

  return (
    <div>
      <div
        className="card"
        style={{ borderStyle: 'dashed', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(243,177,63,0.12)' : undefined }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        role="button"
        aria-label="Upload images"
      >
        <div className="card-title">{loading ? 'Uploading…' : 'Drop images here or click to browse'}</div>
        <div className="helper">JPG, PNG, WebP · max 10 MB each · up to 10 at once</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {done.length > 0 && (
        <div className="helper" style={{ marginTop: 8, wordBreak: 'break-all' }}>
          Uploaded {done.length}: {done[0]}{done.length > 1 ? ` (+${done.length - 1} more)` : ''}
        </div>
      )}
    </div>
  );
}
