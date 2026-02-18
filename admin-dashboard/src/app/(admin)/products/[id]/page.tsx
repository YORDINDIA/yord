import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/utils/audit';
import { getNextId } from '@/lib/utils/ids';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';

async function updateProduct(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const id = Number(formData.get('id'));
  const title = String(formData.get('title') || '').trim();
  const handle = String(formData.get('handle') || '').trim();
  const status = String(formData.get('status') || 'draft');
  const tags = String(formData.get('tags') || '').trim();
  const bodyHtml = String(formData.get('body_html') || '').trim();
  const now = new Date().toISOString();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: before } = await supabase.from('products').select('*').eq('id', id).single();

  await supabase.from('products').update({
    title,
    handle,
    status,
    tags: tags || null,
    body_html: bodyHtml || null,
    updated_at: now,
    published_at: status === 'active' ? now : before?.published_at,
  }).eq('id', id);

  if (user) {
    await logAudit({
      actorId: user.id,
      action: 'update',
      entity: 'products',
      entityId: id,
      before,
      after: { title, handle, status, tags },
    });
  }
}


async function addImage(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const productId = Number(formData.get('product_id'));
  const url = String(formData.get('image_url') || '').trim();
  const alt = String(formData.get('alt') || '').trim();
  if (!url) return;
  const id = await getNextId('product_images');
  const now = new Date().toISOString();
  await supabase.from('product_images').insert({
    id,
    product_id: productId,
    position: 1,
    src: url,
    supabase_url: url,
    alt: alt || null,
    created_at: now,
    updated_at: now,
  });
}

async function updateVariant(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const id = Number(formData.get('variant_id'));
  const price = Number(formData.get('price') || 0);
  const compareAt = formData.get('compare_at_price');
  const inventory = Number(formData.get('inventory_quantity') || 0);
  const now = new Date().toISOString();

  await supabase.from('product_variants').update({
    price,
    compare_at_price: compareAt ? Number(compareAt) : null,
    inventory_quantity: inventory,
    updated_at: now,
  }).eq('id', id);
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const { data: product } = await supabase
    .from('products')
    .select(`*, product_variants(*), product_images(*)`)
    .eq('id', params.id)
    .single();

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Product Detail</div>
            <div className="helper">Last updated {formatDate(product?.updated_at)}</div>
          </div>
          <Link className="button" href="/products">Back</Link>
        </div>
        <form action={updateProduct} className="form-grid">
          <input type="hidden" name="id" value={product?.id} />
          <div>
            <label className="helper">Title</label>
            <input className="input" name="title" defaultValue={product?.title || ''} />
          </div>
          <div>
            <label className="helper">Handle</label>
            <input className="input" name="handle" defaultValue={product?.handle || ''} />
          </div>
          <div>
            <label className="helper">Status</label>
            <select className="select" name="status" defaultValue={product?.status || 'draft'}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="helper">Tags</label>
            <input className="input" name="tags" defaultValue={product?.tags || ''} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Description (HTML)</label>
            <textarea className="textarea" name="body_html" rows={8} defaultValue={product?.body_html || ''} />
          </div>
          <button className="button primary" type="submit">Save Product</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Variants</div>
            <div className="helper">Update pricing and inventory.</div>
          </div>
        </div>
        {(product?.product_variants || []).map((variant) => (
          <form key={variant.id} action={updateVariant} className="form-grid" style={{ marginBottom: 16 }}>
            <input type="hidden" name="variant_id" value={variant.id} />
            <div>
              <label className="helper">Variant Title</label>
              <input className="input" value={variant.title || 'Default'} readOnly />
            </div>
            <div>
              <label className="helper">Price</label>
              <input className="input" name="price" type="number" step="0.01" defaultValue={variant.price || 0} />
            </div>
            <div>
              <label className="helper">Compare At</label>
              <input className="input" name="compare_at_price" type="number" step="0.01" defaultValue={variant.compare_at_price || ''} />
            </div>
            <div>
              <label className="helper">Inventory</label>
              <input className="input" name="inventory_quantity" type="number" defaultValue={variant.inventory_quantity || 0} />
            </div>
            <button className="button" type="submit">Update Variant</button>
          </form>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Images</div>
            <div className="helper">Manage product media.</div>
          </div>
        </div>
        <div className="grid-2">
          {(product?.product_images || []).map((image) => (
            <div key={image.id} className="card" style={{ padding: 12 }}>
              {image.supabase_url && (
                <img src={image.supabase_url} alt={image.alt || ''} style={{ width: '100%', borderRadius: 12 }} />
              )}
              <div className="helper">{image.alt || 'No alt text'}</div>
            </div>
          ))}
        </div>
        <form action={addImage} className="form-grid" style={{ marginTop: 16 }}>
          <input type="hidden" name="product_id" value={product?.id} />
          <div>
            <label className="helper">Image URL</label>
            <input className="input" name="image_url" placeholder="Supabase URL or CDN URL" />
          </div>
          <div>
            <label className="helper">Alt Text</label>
            <input className="input" name="alt" />
          </div>
          <button className="button" type="submit">Add Image</button>
        </form>
      </div>
    </div>
  );
}
