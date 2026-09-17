import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { getNextId } from '@/lib/utils/ids';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import RefundPanel from '../refund-panel';
import StatusBadge from '@/components/ui/StatusBadge';

const FINANCIAL_STATUSES = ['pending', 'paid', 'refunded', 'partially_refunded', 'voided', 'failed'] as const;
const FULFILLMENT_STATUSES = ['unfulfilled', 'fulfilled', 'partial', 'restocked'] as const;

async function updateStatus(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const orderId = Number(formData.get('order_id'));
  const financial_status = String(formData.get('financial_status') || '').trim();
  const fulfillment_status = String(formData.get('fulfillment_status') || '').trim();
  if (!Number.isFinite(orderId) || orderId <= 0) return;
  if (financial_status && !(FINANCIAL_STATUSES as readonly string[]).includes(financial_status)) return;
  if (fulfillment_status && !(FULFILLMENT_STATUSES as readonly string[]).includes(fulfillment_status)) return;
  const { error } = await supabase.from('orders').update({ financial_status, fulfillment_status }).eq('id', orderId);
  if (error) return;
  revalidatePath(`/orders/${orderId}`);
}

async function addFulfillment(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const orderId = Number(formData.get('order_id'));
  if (!Number.isFinite(orderId) || orderId <= 0) return;
  const trackingCompany = String(formData.get('tracking_company') || '').trim();
  const trackingNumber = String(formData.get('tracking_number') || '').trim();
  // Require a tracking number whenever a carrier is set.
  if (trackingCompany && !trackingNumber) return;
  if (!trackingNumber) return;
  const id = await getNextId('fulfillments');
  const now = new Date().toISOString();
  const { error } = await supabase.from('fulfillments').insert({
    id,
    order_id: orderId,
    status: 'success',
    tracking_company: trackingCompany || null,
    tracking_number: trackingNumber || null,
    created_at: now,
    updated_at: now,
  });
  if (error) return;
  await supabase.from('orders').update({ fulfillment_status: 'fulfilled' }).eq('id', orderId);
  revalidatePath(`/orders/${orderId}`);
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
  if (!order) notFound();
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('*')
    .eq('order_id', id);
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_id', id);
  const { data: fulfillments } = await supabase
    .from('fulfillments')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: false });

  const placed = Boolean(order?.created_at);
  const paid = order?.financial_status === 'paid' || order?.financial_status === 'partially_refunded';
  const fulfilled = order?.fulfillment_status === 'fulfilled';
  const refunded = order?.financial_status === 'refunded' || order?.financial_status === 'partially_refunded';
  const steps = [
    { label: 'Placed', done: placed },
    { label: 'Paid', done: paid },
    { label: 'Fulfilled', done: fulfilled },
    { label: 'Refunded', done: refunded },
  ];

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
        <div className="timeline" style={{ marginBottom: 16 }}>
          {steps.map((s) => (
            <span key={s.label} className={`timeline-step${s.done ? ' done' : ''}`}>
              <span className="timeline-dot" />
              {s.label}
            </span>
          ))}
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
          <div>
            <label className="helper">Financial</label>
            <div><StatusBadge value={order?.financial_status} /></div>
          </div>
          <div>
            <label className="helper">Fulfillment</label>
            <div><StatusBadge value={order?.fulfillment_status} /></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Line Items</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Variant / SKU</th>
                <th>Qty</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {(lineItems || []).map((item: { id: number; title: string | null; quantity: number | null; price: number | null; product_id: number | null; variant_title: string | null; sku: string | null }) => (
                <tr key={item.id}>
                  <td>
                    {item.product_id ? (
                      <Link href={`/products/${item.product_id}`}>{item.title}</Link>
                    ) : (
                      item.title
                    )}
                  </td>
                  <td><span className="helper">{item.variant_title || '-'} · {item.sku || 'no SKU'}</span></td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.price, order?.currency || 'INR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Statuses</div>
            <div className="helper">Constrained to valid Shopify-style states.</div>
          </div>
        </div>
        <form action={updateStatus} className="form-grid">
          <input type="hidden" name="order_id" value={order?.id} />
          <div>
            <label className="helper">Financial Status</label>
            <select className="select" name="financial_status" defaultValue={order?.financial_status || 'pending'}>
              {FINANCIAL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="helper">Fulfillment Status</label>
            <select className="select" name="fulfillment_status" defaultValue={order?.fulfillment_status || 'unfulfilled'}>
              {FULFILLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button className="button primary" type="submit">Save Status</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Fulfillment</div>
            <div className="helper">Tracking number required. History newest first.</div>
          </div>
        </div>
        <form action={addFulfillment} className="form-grid">
          <input type="hidden" name="order_id" value={order?.id} />
          <div>
            <label className="helper">Tracking Company</label>
            <input className="input" name="tracking_company" placeholder="Delhivery, Bluedart…" />
          </div>
          <div>
            <label className="helper">Tracking Number (required)</label>
            <input className="input" name="tracking_number" required placeholder="AWB / consignment no." />
          </div>
          <button className="button" type="submit">Add Fulfillment</button>
        </form>
        <div className="helper" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(fulfillments || []).length === 0 && <span>No fulfillments yet.</span>}
          {(fulfillments || []).map((fulfillment: { id: number; tracking_company: string | null; tracking_number: string | null; created_at: string | null }) => (
            <div key={fulfillment.id}>#{fulfillment.id} · {fulfillment.tracking_company || 'Carrier n/a'} · {fulfillment.tracking_number} · {formatDate(fulfillment.created_at)}</div>
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
        <div className="table-wrap">
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
              {(transactions || []).map((txn: { id: number; gateway: string | null; amount: number | null; currency: string | null; status: string | null; payment_id: string | null }) => (
                <tr key={txn.id}>
                  <td>{txn.gateway}</td>
                  <td>{formatCurrency(txn.amount, txn.currency || 'INR')}</td>
                  <td><StatusBadge value={txn.status} /></td>
                  <td>{txn.payment_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Refunds</div>
            <div className="helper">Button disables when nothing is refundable.</div>
          </div>
        </div>
        <RefundPanel orderId={order?.id || 0} transactions={(transactions || []) as never} />
      </div>
    </div>
  );
}
