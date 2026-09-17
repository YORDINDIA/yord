import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/format';

const PAGE_SIZE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const supabase = await createServerClient();
  const resolved = await searchParams;
  const q = resolved?.q?.trim() || '';
  const page = Math.max(1, Number(resolved?.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let request = supabase
    .from('customers')
    .select('id, first_name, last_name, email, total_spent, orders_count, tags', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) {
    const safe = q.replace(/[%(),"]/g, '').trim().slice(0, 100);
    if (safe) request = request.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data: customers, count } = await request;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Customers</div>
          <div className="helper">{count ?? 0} customers · page {page} of {totalPages}</div>
        </div>
        <form>
          <input className="input" name="q" placeholder="Search name or email" defaultValue={q} />
        </form>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Orders</th>
              <th>Total Spent</th>
            </tr>
          </thead>
          <tbody>
            {(customers || []).map((customer) => (
              <tr key={customer.id}>
                <td><Link href={`/customers/${customer.id}`}>{customer.first_name} {customer.last_name}</Link></td>
                <td>{customer.email || '-'}</td>
                <td>{customer.orders_count ?? 0}</td>
                <td>{formatCurrency(customer.total_spent, 'INR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span className="helper">Showing {(customers || []).length} of {count ?? 0}</span>
        <div className="toolbar">
          {page > 1 && <Link className="button" href={`/customers?q=${encodeURIComponent(q)}&page=${page - 1}`}>Previous</Link>}
          {page < totalPages && <Link className="button" href={`/customers?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
