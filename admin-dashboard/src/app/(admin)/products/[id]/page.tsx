import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/utils/audit';
import { getNextId } from '@/lib/utils/ids';
import { formatDate } from '@/lib/utils/format';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import ProductEditor from '@/components/products/ProductEditor';
import VariantEditor from '@/components/products/VariantEditor';
import ImageGrid from '@/components/products/ImageGrid';
import StatusBadge from '@/components/ui/StatusBadge';

async function updateProduct(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) return;
  const title = String(formData.get('title') || '').trim();
  if (!title) return;
  const handle = String(formData.get('handle') || '').trim();
  if (handle && !/^[a-z0-9-]+$/.test(handle)) return;
  const status = String(formData.get('status') || 'draft');
  const tags = String(formData.get('tags') || '').trim();
  const bodyHtml = String(formData.get('body_html') || '').trim();
  const now = new Date().toISOString();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: before } = await supabase.from('products').select('*').eq('id', id).single();

  const { error } = await supabase.from('products').update({
    title,
    handle,
    status,
    tags: tags || null,
    body_html: bodyHtml || null,
    updated_at: now,
    published_at: status === 'active' ? now : before?.published_at,
  }).eq('id', id);
  if (error) return;
  revalidatePath(`/products/${id}`);

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
  if (!Number.isFinite(productId) || productId <= 0) return;
  const url = String(formData.get('image_url') || '').trim();
  const alt = String(formData.get('alt') || '').trim();
  if (!url || (!url.startsWith('https://') && !url.startsWith('/'))) return;
  const id = await getNextId('product_images');
  const now = new Date().toISOString();
  const { error } = await supabase.from('product_images').insert({
    id,
    product_id: productId,
    position: 1,
    src: url,
    supabase_url: url,
    alt: alt || null,
    created_at: now,
    updated_at: now,
  });
  if (error) return;
  revalidatePath(`/products/${productId}`);
}

async function deleteImage(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const imageId = Number(formData.get('image_id'));
  if (!Number.isFinite(imageId) || imageId <= 0) return;
  const { data: image } = await supabase.from('product_images').select('product_id').eq('id', imageId).single();
  if (!image) return;
  await supabase.from('product_images').delete().eq('id', imageId);
  revalidatePath(`/products/${image.product_id}`);
}

async function setCoverImage(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const imageId = Number(formData.get('image_id'));
  if (!Number.isFinite(imageId) || imageId <= 0) return;
  const { data: image } = await supabase.from('product_images').select('id, product_id, position').eq('id', imageId).single();
  if (!image) return;
  // Swap positions: set chosen image to position 0 (cover), keep others as-is.
  await supabase.from('product_images').update({ position: 0, updated_at: new Date().toISOString() }).eq('id', imageId);
  revalidatePath(`/products/${image.product_id}`);
}

async function updateVariantsBulk(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  let rows: { id: number; price: number | null; compare_at_price: number | null; inventory_quantity: number | null }[] = [];
  try {
    rows = JSON.parse(String(formData.get('payload') || '[]'));
  } catch {
    return;
  }
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!Number.isFinite(row.id)) continue;
    const price = row.price === null ? 0 : Number(row.price);
    const compareAt = row.compare_at_price === null ? null : Number(row.compare_at_price);
    const inventory = row.inventory_quantity === null ? 0 : Math.max(0, Math.floor(Number(row.inventory_quantity)));
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(inventory)) continue;
    await supabase.from('product_variants').update({
      price,
      compare_at_price: Number.isFinite(compareAt as number) ? compareAt : null,
      inventory_quantity: inventory,
      updated_at: now,
    }).eq('id', row.id);
  }
  revalidatePath('/products');
  // Also refresh the detail route this action is invoked from, so the editor
  // baseline picks up the saved values.
  const firstRow = rows.find((row) => Number.isFinite(row.id));
  if (firstRow) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('product_id')
      .eq('id', firstRow.id)
      .single();
    if (variant?.product_id) revalidatePath(`/products/${variant.product_id}`);
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: product } = await supabase
    .from('products')
    .select(`*, product_variants(*), product_images(*)`)
    .eq('id', id)
    .single();
  if (!product) notFound();

  const images = [...(product?.product_images || [])].sort(
    (a: { position: number | null }, b: { position: number | null }) => (a.position ?? 99) - (b.position ?? 99),
  );

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Product Detail</div>
            <div className="helper">Last updated {formatDate(product?.updated_at)} · <StatusBadge value={product?.status} /></div>
          </div>
          <Link className="button" href="/products">Back</Link>
        </div>
        <ProductEditor
          product={{
            id: product?.id,
            title: product?.title,
            handle: product?.handle,
            status: product?.status,
            tags: product?.tags,
            body_html: product?.body_html,
          }}
          action={updateProduct}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Variants</div>
            <div className="helper">Edit all rows, then save once.</div>
          </div>
        </div>
        <VariantEditor variants={product?.product_variants || []} action={updateVariantsBulk} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Images</div>
            <div className="helper">First image is the cover. Hover actions to copy, star, delete.</div>
          </div>
        </div>
        <ImageGrid images={images} onDelete={deleteImage} onSetCover={setCoverImage} />
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
