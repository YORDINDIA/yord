import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export default async function DiscountsPage() {
  const supabase = await createServerClient();
  const { data: rules } = await supabase
    .from('price_rules')
    .select('id, title, value, value_type, starts_at, ends_at, discount_codes(code)')
    .order('starts_at', { ascending: false })
    .limit(100);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Discounts</div>
          <div className="helper">Price rules and coupon codes.</div>
        </div>
        <Link className="button primary" href="/discounts/new">New Discount</Link>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Value</th>
            <th>Code</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {(rules || []).map((rule) => (
            <tr key={rule.id}>
              <td>{rule.title}</td>
              <td>{rule.value} {rule.value_type}</td>
              <td>{rule.discount_codes?.[0]?.code || '-'}</td>
              <td>{rule.ends_at ? 'Scheduled' : 'Active'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
