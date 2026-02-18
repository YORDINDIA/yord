import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/format';

export default async function ProductsPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = await createServerClient();
  const query = searchParams?.q?.trim();

  let request = supabase
    .from('products')
    .select('id, title, status, tags, updated_at, product_variants(price, inventory_quantity), product_images(supabase_url)')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (query) {
    request = request.or(`title.ilike.%${query}%,handle.ilike.%${query}%,tags.ilike.%${query}%`);
  }

  const { data: products } = await request;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Catalog</div>
            <div className="helper">Create, update, and publish products.</div>
          </div>
          <div className="flex gap-2">
            <form>
              <input className="input" name="q" placeholder="Search products" defaultValue={query || ''} />
            </form>
            <Link className="button primary" href="/products/new">New Product</Link>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th>Price</th>
              <th>Inventory</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(products || []).map((product) => {
              const price = product.product_variants?.[0]?.price ?? 0;
              const inventory = product.product_variants?.[0]?.inventory_quantity ?? 0;
              return (
                <tr key={product.id}>
                  <td>
                    <Link href={`/products/${product.id}`}>{product.title}</Link>
                    <div className="helper">{product.tags || '-'}</div>
                  </td>
                  <td>{product.status}</td>
                  <td>₹{price}</td>
                  <td>{inventory}</td>
                  <td>{formatDate(product.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
