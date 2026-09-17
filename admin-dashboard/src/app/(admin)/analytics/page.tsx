import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/format';

export default async function AnalyticsPage() {
  const supabase = await createServerClient();
  const day30 = new Date();
  day30.setDate(day30.getDate() - 30);

  const [{ data: orders }, { count: catalogSize }, { data: lineItems }] = await Promise.all([
    supabase
      .from('orders')
      .select('total_price, currency, created_at')
      .gte('created_at', day30.toISOString())
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase
      .from('line_items')
      .select('title, quantity, price, product_id')
      .order('quantity', { ascending: false })
      .limit(100),
  ]);

  const inr = (orders || []).filter((o) => (o.currency || 'INR') === 'INR');
  const revenue30 = inr.reduce((s, o) => s + (Number(o.total_price) || 0), 0);

  // Bucket revenue per day for the last 14 days.
  const days: { label: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const total = inr
      .filter((o) => String(o.created_at).slice(0, 10) === key)
      .reduce((s, o) => s + (Number(o.total_price) || 0), 0);
    days.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), total });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  // Top products by quantity.
  const byProduct = new Map<string, { title: string; productId: number | null; qty: number; revenue: number }>();
  for (const li of lineItems || []) {
    const key = li.title || `Product #${li.product_id}`;
    const prev = byProduct.get(key) || { title: key, productId: li.product_id, qty: 0, revenue: 0 };
    prev.qty += Number(li.quantity) || 0;
    prev.revenue += (Number(li.quantity) || 0) * (Number(li.price) || 0);
    byProduct.set(key, prev);
  }
  const top = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);

  return (
    <div className="grid gap-4">
      <div className="grid-2">
        <div className="card kpi">
          <span className="kpi-label">Revenue · last 30d (INR)</span>
          <span className="kpi-value">{formatCurrency(revenue30, 'INR')}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Catalog Size</span>
          <span className="kpi-value">{catalogSize ?? 0}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Revenue · last 14 days</div>
            <div className="helper">Supabase orders, INR only.</div>
          </div>
          <Link className="button" href="/orders">View orders</Link>
        </div>
        <div>
          {days.map((d) => (
            <div key={d.label} className="bar-row">
              <span className="helper">{d.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.round((d.total / maxDay) * 100)}%` }} />
              </div>
              <span>{formatCurrency(d.total, 'INR')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Top products by units</div>
            <div className="helper">From line items, all time sample.</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Units</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.title}>
                  <td>
                    {t.productId ? (
                      <Link href={`/products/${t.productId}`}>{t.title}</Link>
                    ) : (
                      t.title
                    )}
                  </td>
                  <td>{t.qty}</td>
                  <td>{formatCurrency(t.revenue, 'INR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
