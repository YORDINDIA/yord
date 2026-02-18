import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';

async function createCollection(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const title = String(formData.get('title') || '').trim();
  const handle = String(formData.get('handle') || '').trim();
  const type = String(formData.get('collection_type') || 'custom');
  const published = formData.get('published') === 'on';
  const bodyHtml = String(formData.get('body_html') || '').trim();
  const products = String(formData.get('product_ids') || '').trim();

  const id = await getNextId('collections');
  const now = new Date().toISOString();

  await supabase.from('collections').insert({
    id,
    title,
    handle: handle || title.toLowerCase().replace(/\s+/g, '-'),
    collection_type: type,
    published,
    body_html: bodyHtml || null,
    updated_at: now,
    published_at: published ? now : null,
  });

  if (type === 'custom' && products) {
    const productIds = products.split(',').map((val) => Number(val.trim())).filter(Boolean);
    for (const productId of productIds) {
      const collectId = await getNextId('collects');
      await supabase.from('collects').insert({
        id: collectId,
        collection_id: id,
        product_id: productId,
        created_at: now,
      });
    }
  }
}

export default function NewCollectionPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Collection</div>
          <div className="helper">Manual or rules-based merchandising.</div>
        </div>
        <Link className="button" href="/collections">Back</Link>
      </div>
      <form action={createCollection} className="form-grid">
        <div>
          <label className="helper">Title</label>
          <input className="input" name="title" required />
        </div>
        <div>
          <label className="helper">Handle</label>
          <input className="input" name="handle" placeholder="auto-generated if empty" />
        </div>
        <div>
          <label className="helper">Collection Type</label>
          <select className="select" name="collection_type" defaultValue="custom">
            <option value="custom">Custom</option>
            <option value="smart">Smart</option>
          </select>
        </div>
        <div>
          <label className="helper">Publish</label>
          <input type="checkbox" name="published" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="helper">Description (HTML)</label>
          <textarea className="textarea" name="body_html" rows={5} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="helper">Product IDs (for custom collection)</label>
          <input className="input" name="product_ids" placeholder="comma separated product ids" />
        </div>
        <button className="button primary" type="submit">Create Collection</button>
      </form>
    </div>
  );
}
