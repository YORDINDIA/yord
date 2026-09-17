import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function updateCollection(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) return;
  const title = String(formData.get('title') || '').trim();
  const handle = String(formData.get('handle') || '').trim();
  const published = formData.get('published') === 'on';
  const bodyHtml = String(formData.get('body_html') || '').trim();
  const products = String(formData.get('product_ids') || '').trim();
  const now = new Date().toISOString();

  const { error } = await supabase.from('collections').update({
    title,
    handle,
    published,
    body_html: bodyHtml || null,
    updated_at: now,
    published_at: published ? now : null,
  }).eq('id', id);
  if (error) return;

  const { error: deleteError } = await supabase.from('collects').delete().eq('collection_id', id);
  if (deleteError) return;
  const productIds = products
    .split(',')
    .map((val) => Number(val.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  for (const productId of productIds) {
    const collectId = await getNextId('collects');
    const { error: insertError } = await supabase.from('collects').insert({
      id: collectId,
      collection_id: id,
      product_id: productId,
      created_at: now,
    });
    if (insertError) return;
  }
  revalidatePath(`/collections/${id}`);
}

async function saveRule(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const collectionId = Number(formData.get('collection_id'));
  if (!Number.isFinite(collectionId) || collectionId <= 0) return;
  const column = String(formData.get('column_name') || 'title');
  const relation = String(formData.get('relation') || 'equals');
  const condition = String(formData.get('condition') || '').trim();
  if (!condition) return;

  await supabase.from('smart_collection_rules').insert({
    collection_id: collectionId,
    column_name: column,
    relation,
    condition,
  });
  revalidatePath(`/collections/${collectionId}`);
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: collection } = await supabase
    .from('collections')
    .select('*, collects(product_id), smart_collection_rules(*)')
    .eq('id', id)
    .single();
  if (!collection) notFound();

  const productIds = (collection?.collects || []).map((item: { product_id: number }) => item.product_id).join(', ');

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Collection Detail</div>
            <div className="helper">Edit merchandising rules and products.</div>
          </div>
          <Link className="button" href="/collections">Back</Link>
        </div>
        <form action={updateCollection} className="form-grid">
          <input type="hidden" name="id" value={collection?.id} />
          <div>
            <label className="helper">Title</label>
            <input className="input" name="title" defaultValue={collection?.title || ''} />
          </div>
          <div>
            <label className="helper">Handle</label>
            <input className="input" name="handle" defaultValue={collection?.handle || ''} />
          </div>
          <div>
            <label className="helper">Published</label>
            <input type="checkbox" name="published" defaultChecked={collection?.published ?? false} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Description (HTML)</label>
            <textarea className="textarea" name="body_html" rows={5} defaultValue={collection?.body_html || ''} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Product IDs (custom collections)</label>
            <input className="input" name="product_ids" defaultValue={productIds} />
          </div>
          <button className="button primary" type="submit">Save Collection</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Smart Rules</div>
            <div className="helper">Add rules to auto-curate products.</div>
          </div>
        </div>
        <form action={saveRule} className="form-grid">
          <input type="hidden" name="collection_id" value={collection?.id} />
          <div>
            <label className="helper">Field</label>
            <select className="select" name="column_name" defaultValue="title">
              <option value="title">Title</option>
              <option value="vendor">Vendor</option>
              <option value="product_type">Product Type</option>
              <option value="tags">Tags</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div>
            <label className="helper">Relation</label>
            <select className="select" name="relation" defaultValue="equals">
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="not_equals">Not Equals</option>
            </select>
          </div>
          <div>
            <label className="helper">Condition</label>
            <input className="input" name="condition" />
          </div>
          <button className="button" type="submit">Add Rule</button>
        </form>
        <ul className="helper" style={{ marginTop: 12 }}>
          {(collection?.smart_collection_rules || []).map((rule: { id: number; column_name: string; relation: string; condition: string }) => (
            <li key={rule.id}>{rule.column_name} {rule.relation} {rule.condition}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
