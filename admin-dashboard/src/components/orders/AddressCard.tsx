import type { LucideIcon } from 'lucide-react';
import { describeAddress, type AddressParts } from './format';
import styles from './orders.module.css';

/**
 * One address block in the order side rail.
 *
 * Renders the unavailable case inline ("No shipping address on this order")
 * rather than a blank card, and never invents a default address: the order's own
 * snapshot is what the courier was told.
 */
export default function AddressCard({
  title,
  icon: Icon,
  address,
}: {
  title: string;
  icon: LucideIcon;
  address: AddressParts | null;
}) {
  const { name, lines, phone } = describeAddress(address);

  return (
    <div className="card-inset">
      <div className="row" style={{ marginBottom: 6 }}>
        <Icon size={13} aria-hidden className="tone-icon" />
        <span className="helper-strong">{title}</span>
      </div>
      {lines.length === 0 && !name ? (
        <span className="helper">No {title.toLowerCase()} address on this order.</span>
      ) : (
        <address className={styles.addressBody}>
          {name && <span className={styles.addressName}>{name}</span>}
          {lines.map((line) => (
            <span key={line} className={styles.addressLine}>
              {line}
            </span>
          ))}
          {phone && <span className={styles.addressMeta}>{phone}</span>}
        </address>
      )}
    </div>
  );
}
