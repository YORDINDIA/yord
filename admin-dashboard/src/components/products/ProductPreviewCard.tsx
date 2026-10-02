import Image from 'next/image';
import clsx from 'clsx';
import { ExternalLink, ImageIcon } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/utils/format';
import styles from './products.module.css';

/**
 * Storefront preview for the product side rail.
 *
 * Server component: it renders static markup and reads `NEXT_PUBLIC_APP_URL` at
 * request time to build the product link. When that variable is unset (or the
 * product has no handle) the path is shown as plain text rather than a link to
 * somewhere that does not exist.
 */
export default function ProductPreviewCard({
  product,
  imageUrl,
  price,
  compareAtPrice,
}: {
  product: { title: string; handle: string | null; status: string | null };
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
}) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? '';
  const path = product.handle ? `/products/${product.handle}` : null;
  const href = base && path ? `${base}${path}` : null;
  const showCompareAt = compareAtPrice !== null && compareAtPrice > price;

  return (
    <div className="card">
      <div className="card-header">
        <div className="section-title">Storefront preview</div>
        <StatusBadge value={product.status} />
      </div>

      <div className={styles.previewFrame}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 900px) 100vw, 296px"
          />
        ) : (
          <ImageIcon size={22} aria-hidden />
        )}
      </div>

      <div className="stack-sm" style={{ marginTop: 10 }}>
        <div className="strong truncate" title={product.title}>
          {product.title}
        </div>
        {/* `wrapRow` + `railRow`: two unbreakable price tokens and a long
            handle path are flex items, so they must be allowed to wrap or
            shrink inside the 294px rail instead of overflowing the card. */}
        <div className={clsx('row', styles.wrapRow)}>
          <span className="num strong">{formatCurrency(price)}</span>
          {showCompareAt && (
            <span className={styles.was}>{formatCurrency(compareAtPrice)}</span>
          )}
        </div>
        {href ? (
          <a
            className={clsx('row', 'helper', styles.railRow)}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Open this product on the storefront"
          >
            <span className={clsx('mono', styles.railLabel)}>{path}</span>
            <ExternalLink size={12} aria-hidden className={styles.iconFixed} />
          </a>
        ) : (
          <span
            className={clsx('helper', 'truncate', 'mono', styles.railRow)}
            title={path ? 'Set NEXT_PUBLIC_APP_URL to open the storefront' : undefined}
          >
            {path ?? 'No handle yet'}
          </span>
        )}
      </div>
    </div>
  );
}
