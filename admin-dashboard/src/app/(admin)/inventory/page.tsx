import { createServerClient } from '@/lib/supabase/server';

export default async function InventoryPage() {
  const supabase = await createServerClient();
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, title, inventory_quantity, product:products(title, handle)')
    .order('inventory_quantity', { ascending: true })
    .limit(100);

  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Inventory Overview</div>
            <div className="helper">Sorted by lowest stock.</div>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>Inventory</th>
            </tr>
          </thead>
          <tbody>
            {(variants || []).map((variant) => (
              <tr key={variant.id}>
                <td>{variant.product?.title}</td>
                <td>{variant.title || 'Default'}</td>
                <td>{variant.inventory_quantity ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Locations</div>
            <div className="helper">Fulfillment and stock points.</div>
          </div>
        </div>
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
                <td>{location.active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
