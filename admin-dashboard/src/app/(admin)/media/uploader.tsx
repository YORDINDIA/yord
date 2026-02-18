"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MediaUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    const path = `admin/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Uploaded to Supabase Storage.');
    }
  }

  return (
    <div className="form-grid">
      <div>
        <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <div>
        <button className="button" type="button" onClick={handleUpload} disabled={loading}>Upload</button>
      </div>
      {message && <div className="helper">{message}</div>}
    </div>
  );
}
