import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import StatusBadge from '@/components/ui/StatusBadge';
import QuantityStepper from '@/components/inventory/QuantityStepper';

async function updateInventory(formData: FormData): Promise<{ error?: string }> {
  'use server';
  const supabase = await createServerClient();
  const variantId = Number(formData.get('variant_id'));
  const qty = Math.max(0, Math.floor(Number(formData.get('inventory_quantity') || 0)));
  if (!Number.isFinite(variantId) || variantId <= 0 || !Number.isFinite(qty)) {
    return { error: 'Invalid quantity' };
  }
  const { error } = await supabase
    .from('product_variants')
    .update({ inventory_quantity: qty, updated_at: new Date().toISOString() })
    .eq('id', variantId);
  if (error) {
    console.error('Inventory update failed', variantId, error);
    return { error: 'Could not save inventory' };
  }
  revalidatePath('/inventory');
  return {};
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const supabase = await createServerClient();
  const resolved = await searchParams;
  const tab = resolved?.tab === 'locations' ? 'locations' : 'stock';
  const q = resolved?.q?.trim() || '';

  // Search runs server-side on variant + product title so matches are not
  // limited to the first page of lowest-stock rows.
  let variantsQuery = supabase
    .from('product_variants')
    .select('id, title, inventory_quantity, product:products!inner(id, title, handle)')
    .order('inventory_quantity', { ascending: true })
    .limit(100);
  if (q) {
    const safe = q.replace(/[%(),"]/g, '').trim().slice(0, 100);
    if (safe) variantsQuery = variantsQuery.or(`title.ilike.%${safe}%,product.title.ilike.%${safe}%`);
  }
  const { data: variants } = await variantsQuery;

  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });

  type VariantWithProduct = {
    id: number;
    title: string | null;
    inventory_quantity: number | null;
    product: { id: number; title: string } | { id: number; title: string }[] | null;
  };

  const visible = (variants || []) as VariantWithProduct[];

  return (
    <div className="grid gap-4">
      <div className="toolbar">
        <Link className={`button${tab === 'stock' ? ' primary' : ''}`} href="/inventory?tab=stock">Stock</Link>
        <Link className={`button${tab === 'locations' ? ' primary' : ''}`} href="/inventory?tab=locations">Locations</Link>
      </div>

      {tab === 'stock' ? (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">Inventory Overview</div>
              <div className="helper">Sorted by lowest stock. Step to adjust, save per row.</div>
            </div>
            <form>
              <input type="hidden" name="tab" value="stock" />
              <input className="input" name="q" placeholder="Filter variants" defaultValue={q} />
            </form>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>Status</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((variant) => {
                  const qty = variant.inventory_quantity ?? 0;
                  const product = Array.isArray(variant.product) ? variant.product[0] : variant.product;
                  return (
                    <tr key={variant.id}>
                      <td>
                        {product?.id ? (
                          <Link href={`/products/${product.id}`}>{product.title}</Link>
                        ) : (
                          product?.title || '-'
                        )}
                      </td>
                      <td>{variant.title || 'Default'}</td>
                      <td>
                        <StatusBadge
                          value={qty <= 0 ? 'out' : qty <= 5 ? 'low' : 'ok'}
                          label={qty <= 0 ? 'Out of stock' : qty <= 5 ? `Low · ${qty}` : `In stock · ${qty}`}
                        />
                      </td>
                      <td><QuantityStepper variantId={variant.id} initial={qty} action={updateInventory} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">Locations</div>
              <div className="helper">Fulfillment and stock points.</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {(locations || []).map((location) => (
                  <tr key={location.id}>
                    <td>{location.name}</td>
                    <td>{location.city || '-'}</td>
                    <td><StatusBadge value={location.active ? 'yes' : 'no'} label={location.active ? 'Active' : 'Inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
