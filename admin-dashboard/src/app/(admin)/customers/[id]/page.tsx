import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/format';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function updateCustomer(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id) || id <= 0) return;
  const tags = String(formData.get('tags') || '').trim();
  const note = String(formData.get('note') || '').trim();
  const { error } = await supabase.from('customers').update({ tags: tags || null, note: note || null }).eq('id', id);
  if (error) return;
  revalidatePath(`/customers/${id}`);
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).single();
  if (!customer) notFound();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, name, total_price, currency')
    .eq('customer_id', id);
  const { data: addresses } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', id);

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Customer Profile</div>
            <div className="helper">{customer?.email || 'No email on file'}</div>
          </div>
          <Link className="button" href="/customers">Back</Link>
        </div>
        <div className="form-grid">
          <div>
            <label className="helper">Name</label>
            <div>{customer?.first_name} {customer?.last_name}</div>
          </div>
          <div>
            <label className="helper">Total Spent</label>
            <div>{formatCurrency(customer?.total_spent, 'INR')}</div>
          </div>
        </div>
        <form action={updateCustomer} className="form-grid" style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={customer?.id} />
          <div>
            <label className="helper">Tags</label>
            <input className="input" name="tags" defaultValue={customer?.tags || ''} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Note</label>
            <textarea className="textarea" name="note" rows={4} defaultValue={customer?.note || ''} />
          </div>
          <button className="button primary" type="submit">Save Notes</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Addresses</div>
        </div>
        <ul className="helper">
          {(addresses || []).map((address) => (
            <li key={address.id}>{address.address1}, {address.city}, {address.country}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Orders</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(orders || []).map((order) => (
              <tr key={order.id}>
                <td><Link href={`/orders/${order.id}`}>{order.name}</Link></td>
                <td>{formatCurrency(order.total_price, order.currency || 'INR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
