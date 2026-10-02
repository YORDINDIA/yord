import Link from 'next/link';
import clsx from 'clsx';
import { formatDate } from '@/lib/utils/format';
import type { ProductCollectionLink } from '@/lib/data/products';
import styles from './products.module.css';

/** Chips drawn before the rest are counted. */
const TAG_LIMIT = 12;
/** Collection links drawn before the rest are counted. */
const COLLECTION_LIMIT = 6;

/**
 * One label/value row.
 *
 * The rail is a fixed 320px column (294px of card content), so both halves are
 * given a shrinkable width: the label ellipsises, the value may break inside a
 * long word. Without `min-width: 0` a flex item keeps its min-content width and
 * the row overflows the card instead.
 */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={clsx('row-between', styles.railRow)}>
      <span className={clsx('helper', styles.railLabel)}>{label}</span>
      <span className={clsx('mono', styles.railValue)}>{children}</span>
    </div>
  );
}

/**
 * Identity and provenance for the product side rail: ids, dates, tags, and the
 * collections the product belongs to (read by `listProductCollections`).
 */
export default function ProductMetaCard({
  product,
  collections,
}: {
  product: {
    id: number;
    vendor: string | null;
    product_type: string | null;
    created_at: string | null;
    updated_at: string | null;
    published_at: string | null;
    tags: string | null;
  };
  collections: ProductCollectionLink[];
}) {
  const tags = (product.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const shownTags = tags.slice(0, TAG_LIMIT);
  const shownCollections = collections.slice(0, COLLECTION_LIMIT);

  return (
    <div className="card">
      <div className="card-header">
        <div className="section-title">Details</div>
      </div>

      <div className="stack-sm">
        <MetaRow label="ID">#{product.id}</MetaRow>
        {product.vendor && <MetaRow label="Vendor">{product.vendor}</MetaRow>}
        {product.product_type && <MetaRow label="Type">{product.product_type}</MetaRow>}
        <MetaRow label="Created">{formatDate(product.created_at)}</MetaRow>
        <MetaRow label="Updated">{formatDate(product.updated_at)}</MetaRow>
        <MetaRow label="Published">{formatDate(product.published_at)}</MetaRow>
      </div>

      <hr className="hr" />

      <div className="helper" style={{ marginBottom: 6 }}>
        Tags
      </div>
      {shownTags.length > 0 ? (
        <div className="tag-list">
          {shownTags.map((tag) => (
            <span key={tag} className={clsx('chip', styles.chipCap)} title={tag}>
              <span className={styles.chipText}>{tag}</span>
            </span>
          ))}
          {tags.length > TAG_LIMIT && <span className="helper">+ {tags.length - TAG_LIMIT} more</span>}
        </div>
      ) : (
        <div className="helper">No tags on this product.</div>
      )}

      <hr className="hr" />

      <div className="helper" style={{ marginBottom: 6 }}>
        Collections
      </div>
      {shownCollections.length > 0 ? (
        <div className={clsx('row', styles.wrapRow)}>
          {shownCollections.map((collection) => (
            <Link
              key={collection.id}
              className={clsx('chip', styles.chipCap)}
              href={`/collections/${collection.id}`}
              title={collection.title}
            >
              <span className={styles.chipText}>{collection.title}</span>
            </Link>
          ))}
          {collections.length > COLLECTION_LIMIT && (
            <span className="helper">+ {collections.length - COLLECTION_LIMIT} more</span>
          )}
        </div>
      ) : (
        <div className="helper">
          Not in any collection. Membership of keyword collections comes from tags.
        </div>
      )}
    </div>
  );
}
