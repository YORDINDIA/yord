import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  CalendarDays,
  CircleDollarSign,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Receipt,
  ShoppingBag,
  Users,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Sparkline from '@/components/charts/Sparkline';
import CopyEmailButton from '@/components/customers/CopyEmailButton';
import CustomerNotesForm from '@/components/customers/CustomerNotesForm';
import { customerName, formatRelative, formatTimestamp } from '@/components/customers/display';
import { getCustomer, getCustomerStats, type CustomerOrderRow } from '@/lib/data/customers';
import { formatCurrency, formatDate } from '@/lib/utils/format';

type Params = Promise<{ id: string }>;

const countFormat = new Intl.NumberFormat('en-IN');

/**
 * `CHART_TONES[6]` is cyan — the Customers section hue (`chart-theme.ts` holds
 * the ramp order). A number rather than the imported name because that module
 * is a client module: from the server its exports are client references, not
 * values.
 */
const CYAN_CHART_TONE = 6;

/** Shopify customer states → badge tones. Unknown states stay neutral. */
const STATE_TONE: Record<string, 'success' | 'info' | 'neutral' | 'danger'> = {
  enabled: 'success',
  invited: 'info',
  disabled: 'neutral',
  declined: 'danger',
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Label/value row for the profile card. */
function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row-between">
      <span className="helper">{label}</span>
      <span className="strong">{value}</span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCustomer(Number(id)).catch(() => null);
  if (!detail) return { title: 'Customer · YORD Admin' };
  return { title: `${customerName(detail.customer)} · YORD Admin` };
}

/**
 * Customer detail.
 *
 * One `getCustomer()` read (orders and addresses in parallel) plus the bounded
 * counts behind the stat strip and the "vs top spender" meter. Three sequential
 * reads became one; the order table went through `DataTable` so it scrolls
 * instead of overflowing a phone; and the notes form is bound to
 * `updateCustomerAction`, which audits the change instead of discarding the
 * write error.
 *
 * Spend figures come from `customers.total_spent` / `orders_count` — the
 * denormalized Shopify counters the list also shows — while the order table and
 * the sparkline render the live order rows.
 */
export default async function CustomerDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [detail, stats] = await Promise.all([getCustomer(numericId), getCustomerStats()]);
  if (!detail) notFound();

  const { customer, orders, addresses } = detail;
  const name = customerName(customer);
  const email = customer.email?.trim() || null;
  const ordersCount = customer.orders_count ?? orders.length;
  const lifetime = Number(customer.total_spent ?? 0);
  const averageOrder = ordersCount > 0 ? lifetime / ordersCount : 0;
  // `getCustomer` orders newest-first.
  const lastOrderAt = orders[0]?.created_at ?? null;
  const stateTone = customer.state ? STATE_TONE[customer.state] ?? 'neutral' : null;
  const ordersHref = email ? `/orders?q=${encodeURIComponent(email)}` : '/orders';
  // Oldest → newest, so the line rises to the right like a trend line should.
  const spendTrend = orders
    .slice(0, 12)
    .reverse()
    .map((order) => Number(order.total_price) || 0);

  const orderColumns: DataTableColumn<CustomerOrderRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => <Link href={`/orders/${order.id}`}>{order.name || `#${order.id}`}</Link>,
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (order) => <StatusBadge value={order.financial_status} />,
    },
    {
      key: 'fulfillment',
      header: 'Fulfillment',
      hideOnTablet: true,
      render: (order) => <StatusBadge value={order.fulfillment_status} />,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (order) => (
        <span className="table-num">
          {formatCurrency(order.total_price, order.currency || 'INR')}
        </span>
      ),
    },
    {
      key: 'placed',
      header: 'Placed',
      hideOnMobile: true,
      render: (order) => (
        <span className="nowrap" title={formatTimestamp(order.created_at)}>
          {formatDate(order.created_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Users}
        title={name}
        description={email ?? 'No email on file'}
        tone="cyan"
        actions={
          <>
            {email && (
              <a className="button" href={`mailto:${email}`}>
                <Mail size={14} aria-hidden />
                Email
              </a>
            )}
            <CopyEmailButton email={email} />
            <Link className="button" href={ordersHref}>
              <ShoppingBag size={14} aria-hidden />
              View orders
            </Link>
          </>
        }
      />

      {/* Identity: the avatar + status/marketing marks. `PageHeader` has no
          avatar slot, so it sits directly under it rather than inside. */}
      <div className="row" style={{ gap: 10 }}>
        <Avatar name={name} email={email} size="lg" />
        <div className="stack-sm" style={{ gap: 4, minWidth: 0 }}>
          <div className="tag-list">
            {customer.state && stateTone && (
              <StatusBadge
                value={customer.state}
                label={titleCase(customer.state)}
                tone={stateTone}
                dot
                size="md"
              />
            )}
            <span
              className={`chip tone ${customer.accepts_marketing ? 'tone-cyan' : 'tone-slate'}`}
            >
              {customer.accepts_marketing ? 'Marketing opt-in' : 'No marketing'}
            </span>
            {customer.verified_email && (
              <span className="chip tone tone-emerald">Email verified</span>
            )}
          </div>
          <div className="helper">
            Customer since {formatDate(customer.created_at)} ({formatRelative(customer.created_at)})
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Total spent"
          value={formatCurrency(lifetime, 'INR')}
          icon={IndianRupee}
          tone="saffron"
          valueSm
          hint="Lifetime, all orders"
        />
        <StatCard
          label="Orders"
          value={countFormat.format(ordersCount)}
          icon={Receipt}
          tone="blue"
          hint={
            ordersCount >= 2 ? 'Repeat buyer' : ordersCount === 1 ? 'One-time buyer' : 'No orders yet'
          }
        />
        <StatCard
          label="Average order"
          value={ordersCount > 0 ? formatCurrency(averageOrder, 'INR') : '—'}
          icon={CircleDollarSign}
          tone="violet"
          valueSm
          hint={ordersCount > 0 ? `Across ${ordersCount} orders` : 'No orders yet'}
        />
        <StatCard
          label="Last order"
          value={lastOrderAt ? formatRelative(lastOrderAt) : '—'}
          icon={CalendarDays}
          tone="cyan"
          hint={lastOrderAt ? formatDate(lastOrderAt) : 'Never ordered'}
        />
      </div>

      <div className="layout-split">
        <div className="stack">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="section-title">Order history</div>
                <div className="helper">
                  {orders.length} {orders.length === 1 ? 'order' : 'orders'} on file
                  {lifetime > 0 ? ` · ${formatCurrency(lifetime, 'INR')} lifetime` : ''}
                </div>
              </div>
              {spendTrend.length > 1 && (
                <div style={{ width: 140, flex: 'none' }}>
                  <Sparkline
                    data={spendTrend}
                    height={26}
                    tone={CYAN_CHART_TONE}
                    ariaLabel={`Order totals for ${name}, oldest to newest`}
                  />
                </div>
              )}
            </div>
            <DataTable
              caption={`Orders placed by ${name}`}
              columns={orderColumns}
              rows={orders}
              rowKey={(order) => order.id}
              dense
              stickyHeader
              emptyTitle="No orders yet"
              emptyHint={`${name} has not placed an order in this store.`}
              emptyIcon={<Receipt size={28} />}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="section-title">Addresses</div>
                {addresses.length > 0 && (
                  <div className="helper">{addresses.length} on file</div>
                )}
              </div>
            </div>
            {addresses.length === 0 ? (
              <EmptyState
                icon={<MapPin size={28} />}
                title="No addresses on file"
                hint="Shipping and billing addresses arrive with the customer's first order."
              />
            ) : (
              <div className="grid-2">
                {addresses.map((address) => {
                  const lines = [
                    address.address1,
                    address.address2,
                    [address.city, address.province, address.zip].filter(Boolean).join(', '),
                    address.country,
                  ].filter((line): line is string => Boolean(line && line.trim()));
                  const person = [address.first_name, address.last_name]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div key={address.id} className="card-inset">
                      <div className="row-between">
                        <div className="row">
                          <span className="tone-tile">
                            <MapPin size={14} aria-hidden />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="cell-media-title truncate">{person || 'Address'}</div>
                            {address.company && (
                              <div className="helper truncate">{address.company}</div>
                            )}
                          </div>
                        </div>
                        {address.is_default && <span className="chip">Default</span>}
                      </div>
                      <div className="helper" style={{ marginTop: 8 }}>
                        {lines.map((line, index) => (
                          <div key={index}>{line}</div>
                        ))}
                      </div>
                      {address.phone && (
                        <div className="row helper" style={{ marginTop: 6 }}>
                          <Phone size={14} aria-hidden />
                          {address.phone}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="section-title">Notes & tags</div>
                <div className="helper">Internal only — never shown to the customer.</div>
              </div>
            </div>
            <CustomerNotesForm
              customerId={customer.id}
              tags={customer.tags}
              note={customer.note}
            />
          </div>
        </div>

        <aside className="side-rail">
          <div className="card">
            <div className="card-header">
              <div className="section-title">Profile</div>
            </div>
            <div className="stack-sm">
              <MetaRow label="Customer ID" value={<span className="mono">{customer.id}</span>} />
              <MetaRow label="Created" value={formatDate(customer.created_at)} />
              <MetaRow label="Updated" value={formatDate(customer.updated_at)} />
              <MetaRow
                label="Marketing"
                value={customer.accepts_marketing ? 'Opted in' : 'Not opted in'}
              />
              {customer.verified_email && <MetaRow label="Email" value="Verified" />}
              {customer.phone && <MetaRow label="Phone" value={customer.phone} />}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Activity</div>
              {ordersCount >= 2 ? (
                <span className="chip tone tone-cyan">Repeat buyer</span>
              ) : (
                <span className="chip">
                  {ordersCount === 1 ? 'One-time buyer' : 'No orders'}
                </span>
              )}
            </div>
            <div className="stack-sm">
              <MetaRow label="Lifetime value" value={formatCurrency(lifetime, 'INR')} />
              <MetaRow
                label="Average order"
                value={ordersCount > 0 ? formatCurrency(averageOrder, 'INR') : '—'}
              />
              <MetaRow label="Orders" value={countFormat.format(ordersCount)} />
              <MetaRow
                label="Last order"
                value={lastOrderAt ? formatDate(lastOrderAt) : 'Never ordered'}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <ProgressBar
                value={lifetime}
                max={stats.topSpend}
                tone="cyan"
                size="sm"
                label={
                  stats.topSpend > 0
                    ? `vs top spender ${formatCurrency(stats.topSpend, 'INR')}`
                    : 'No store spend yet'
                }
              />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
