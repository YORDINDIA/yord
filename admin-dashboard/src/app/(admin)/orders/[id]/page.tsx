import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { getNextId } from '@/lib/utils/ids';
import Link from 'next/link';
import RefundPanel from '../refund-panel';

async function updateStatus(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const orderId = Number(formData.get('order_id'));
  const financial_status = String(formData.get('financial_status') || '').trim();
  const fulfillment_status = String(formData.get('fulfillment_status') || '').trim();
  await supabase.from('orders').update({ financial_status, fulfillment_status }).eq('id', orderId);
}

async function addFulfillment(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const orderId = Number(formData.get('order_id'));
  const trackingCompany = String(formData.get('tracking_company') || '').trim();
  const trackingNumber = String(formData.get('tracking_number') || '').trim();
  const id = await getNextId('fulfillments');
  const now = new Date().toISOString();
  await supabase.from('fulfillments').insert({
    id,
    order_id: orderId,
    status: 'success',
    tracking_company: trackingCompany || null,
    tracking_number: trackingNumber || null,
    created_at: now,
    updated_at: now,
  });
  await supabase.from('orders').update({ fulfillment_status: 'fulfilled' }).eq('id', orderId);
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.id)
    .single();
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('*')
    .eq('order_id', params.id);
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_id', params.id);
  const { data: fulfillments } = await supabase
    .from('fulfillments')
    .select('*')
    .eq('order_id', params.id);

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Order {order?.name}</div>
            <div className="helper">Created {formatDate(order?.created_at)}</div>
          </div>
          <Link className="button" href="/orders">Back</Link>
        </div>
        <div className="form-grid">
          <div>
            <label className="helper">Total</label>
            <div>{formatCurrency(order?.total_price, order?.currency || 'INR')}</div>
          </div>
          <div>
            <label className="helper">Customer Email</label>
            <div>{order?.email || '-'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Line Items</div>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Qty</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {(lineItems || []).map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.price, order?.currency || 'INR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Statuses</div>
            <div className="helper">Update financial or fulfillment status.</div>
          </div>
        </div>
        <form action={updateStatus} className="form-grid">
          <input type="hidden" name="order_id" value={order?.id} />
          <div>
            <label className="helper">Financial Status</label>
            <input className="input" name="financial_status" defaultValue={order?.financial_status || ''} />
          </div>
          <div>
            <label className="helper">Fulfillment Status</label>
            <input className="input" name="fulfillment_status" defaultValue={order?.fulfillment_status || ''} />
          </div>
          <button className="button primary" type="submit">Save Status</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Fulfillment</div>
            <div className="helper">Add tracking details.</div>
          </div>
        </div>
        <form action={addFulfillment} className="form-grid">
          <input type="hidden" name="order_id" value={order?.id} />
          <div>
            <label className="helper">Tracking Company</label>
            <input className="input" name="tracking_company" />
          </div>
          <div>
            <label className="helper">Tracking Number</label>
            <input className="input" name="tracking_number" />
          </div>
          <button className="button" type="submit">Add Fulfillment</button>
        </form>
        <div className="helper" style={{ marginTop: 12 }}>
          {(fulfillments || []).map((fulfillment) => (
            <div key={fulfillment.id}>#{fulfillment.id} · {fulfillment.tracking_company} {fulfillment.tracking_number}</div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Transactions</div>
            <div className="helper">Refunds are processed via Razorpay.</div>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Gateway</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment Id</th>
            </tr>
          </thead>
          <tbody>
            {(transactions || []).map((txn) => (
              <tr key={txn.id}>
                <td>{txn.gateway}</td>
                <td>{formatCurrency(txn.amount, txn.currency || 'INR')}</td>
                <td>{txn.status}</td>
                <td>{txn.payment_id || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Refunds</div>
            <div className="helper">Trigger a Razorpay refund and sync status.</div>
          </div>
        </div>
        <RefundPanel orderId={order?.id || 0} transactions={(transactions || []) as any} />
      </div>
    </div>
  );
}
