import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import CustomerNotesForm from '@/components/customers/CustomerNotesForm';
import { getCustomer } from '@/lib/data/customers';
import { formatCurrency } from '@/lib/utils/format';
import type { Order } from '@yord/db-types';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCustomer(Number(id)).catch(() => null);
  if (!detail) return { title: 'Customer · YORD Admin' };
  const name = `${detail.customer.first_name ?? ''} ${detail.customer.last_name ?? ''}`.trim();
  return { title: `${name || 'Customer'} · YORD Admin` };
}

/**
 * Customer detail.
 *
 * Three sequential reads became one `getCustomer()` with the two child reads in
 * parallel. The order table was a bare `<table className="table">` with no
 * `.table-wrap`, so it overflowed the viewport on a phone; it now goes through
 * `DataTable`. The notes form is bound to `updateCustomerAction`, which audits
 * the change instead of discarding the write error.
 */
export default async function CustomerDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const detail = await getCustomer(numericId);
  if (!detail) notFound();

  const { customer, orders, addresses } = detail;

  const orderColumns: DataTableColumn<Pick<Order, 'id' | 'name' | 'total_price' | 'currency'>>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => <Link href={`/orders/${order.id}`}>{order.name || `#${order.id}`}</Link>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (order) => formatCurrency(order.total_price, order.currency || 'INR'),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Customer Profile</div>
            <div className="helper">{customer.email || 'No email on file'}</div>
          </div>
          <Link className="button" href="/customers">
            Back
          </Link>
        </div>
        <div className="form-grid">
          <div>
            <span className="helper">Name</span>
            <div>
              {customer.first_name} {customer.last_name}
            </div>
          </div>
          <div>
            <span className="helper">Total Spent</span>
            <div>{formatCurrency(customer.total_spent, 'INR')}</div>
          </div>
          <div>
            <span className="helper">Orders</span>
            <div>{customer.orders_count ?? orders.length}</div>
          </div>
        </div>
        <CustomerNotesForm
          customerId={customer.id}
          tags={customer.tags}
          note={customer.note}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Addresses</div>
        </div>
        {addresses.length === 0 ? (
          <p className="helper">No addresses on file.</p>
        ) : (
          <ul className="helper">
            {addresses.map((address) => (
              <li key={address.id}>
                {address.address1}, {address.city}, {address.country}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Orders</div>
        </div>
        <DataTable
          caption="Customer orders"
          columns={orderColumns}
          rows={orders}
          rowKey={(order) => order.id}
          emptyTitle="No orders yet"
          emptyHint="This customer has not placed an order."
        />
      </div>
    </div>
  );
}
