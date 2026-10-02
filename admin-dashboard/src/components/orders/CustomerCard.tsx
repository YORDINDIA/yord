import Link from 'next/link';
import { CreditCard, Phone, Truck } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import AddressCard from './AddressCard';
import type { AddressParts } from './format';

/**
 * Who ordered, and where it was sent.
 *
 * The address blocks come from the order's own snapshots
 * (`order_shipping_addresses` / `order_billing_addresses`), not from the
 * customer's saved addresses: the courier was given the snapshot, and the
 * customer's address book may have changed since.
 */
export default function CustomerCard({
  name,
  email,
  phone,
  customerHref,
  shipping,
  billing,
}: {
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Link to the customer record, when the order carries a usable customer id. */
  customerHref: string | null;
  shipping: AddressParts | null;
  billing: AddressParts | null;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="section-title">Customer</span>
        {customerHref && (
          <Link className="button small" href={customerHref}>
            Open
          </Link>
        )}
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Avatar size="lg" name={name} email={email} />
        <div className="stack-sm" style={{ minWidth: 0 }}>
          <div className="list-row-title">{name || 'Guest checkout'}</div>
          {email ? (
            <a className="helper" href={`mailto:${email}`}>
              {email}
            </a>
          ) : (
            <span className="helper">no email on file</span>
          )}
          {phone && (
            <span className="row helper">
              <Phone size={11} aria-hidden />
              <a href={`tel:${phone}`}>{phone}</a>
            </span>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <AddressCard title="Shipping" icon={Truck} address={shipping} />
        <AddressCard title="Billing" icon={CreditCard} address={billing} />
      </div>
    </div>
  );
}
