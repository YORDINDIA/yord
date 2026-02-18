import { createServerClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';
import { logAudit } from '@/lib/utils/audit';
import Link from 'next/link';

async function createProduct(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const title = String(formData.get('title') || '').trim();
  const handle = String(formData.get('handle') || '').trim();
  const vendor = String(formData.get('vendor') || '').trim();
  const productType = String(formData.get('product_type') || '').trim();
  const tags = String(formData.get('tags') || '').trim();
  const bodyHtml = String(formData.get('body_html') || '').trim();
  const price = Number(formData.get('price') || 0);
  const inventory = Number(formData.get('inventory') || 0);

  const productId = await getNextId('products');
  const variantId = await getNextId('product_variants');

  const now = new Date().toISOString();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from('products').insert({
    id: productId,
    title,
    handle: handle || title.toLowerCase().replace(/\s+/g, '-'),
    vendor: vendor || 'YORD',
    product_type: productType || 'Apparel',
    tags: tags || null,
    body_html: bodyHtml || null,
    status: 'draft',
    created_at: now,
    updated_at: now,
  });

  await supabase.from('product_variants').insert({
    id: variantId,
    product_id: productId,
    title: 'Default',
    price,
    inventory_quantity: inventory,
    position: 1,
    created_at: now,
    updated_at: now,
  });

  if (user) {
    await logAudit({
      actorId: user.id,
      action: 'create',
      entity: 'products',
      entityId: productId,
      after: { title, handle, price, inventory },
    });
  }
}

export default function NewProductPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Product</div>
          <div className="helper">Create a draft listing and add details later.</div>
        </div>
        <Link className="button" href="/products">Back</Link>
      </div>
      <form action={createProduct} className="form-grid">
        <div>
          <label className="helper">Title</label>
          <input className="input" name="title" required />
        </div>
        <div>
          <label className="helper">Handle</label>
          <input className="input" name="handle" placeholder="auto-generated if empty" />
        </div>
        <div>
          <label className="helper">Vendor</label>
          <input className="input" name="vendor" defaultValue="YORD" />
        </div>
        <div>
          <label className="helper">Product Type</label>
          <input className="input" name="product_type" defaultValue="Apparel" />
        </div>
        <div>
          <label className="helper">Tags</label>
          <input className="input" name="tags" placeholder="comma separated" />
        </div>
        <div>
          <label className="helper">Price</label>
          <input className="input" name="price" type="number" step="0.01" defaultValue={0} />
        </div>
        <div>
          <label className="helper">Inventory</label>
          <input className="input" name="inventory" type="number" defaultValue={0} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="helper">Description (HTML)</label>
          <textarea className="textarea" name="body_html" rows={6} />
        </div>
        <button className="button primary" type="submit">Create Draft</button>
      </form>
    </div>
  );
}
