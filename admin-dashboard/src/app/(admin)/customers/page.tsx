import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils/format';

export default async function CustomersPage() {
  const supabase = await createServerClient();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, total_spent, orders_count, tags')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Customers</div>
          <div className="helper">Profile and order history.</div>
        </div>
      </div>
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
  );
}
