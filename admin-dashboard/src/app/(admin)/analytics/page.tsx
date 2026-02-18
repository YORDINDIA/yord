import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/format';

export default async function AnalyticsPage() {
  const supabase = await createServerClient();
  const { data: orders } = await supabase.from('orders').select('total_price, currency').order('created_at', { ascending: false }).limit(500);
  const { data: products } = await supabase.from('products').select('id', { count: 'exact', head: true });
  const revenue = (orders || []).reduce((sum, order) => sum + (order.total_price || 0), 0);

  return (
    <div className="grid gap-4">
      <div className="grid-2">
        <div className="card kpi">
          <span className="kpi-label">Revenue (sample)</span>
          <span className="kpi-value">{formatCurrency(revenue, 'INR')}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Catalog Size</span>
          <span className="kpi-value">{products.count ?? 0}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Notes</div>
            <div className="helper">Integrate external analytics for traffic and conversion.</div>
          </div>
        </div>
        <div className="helper">Current KPIs are based on Supabase orders data.</div>
      </div>
    </div>
  );
}
