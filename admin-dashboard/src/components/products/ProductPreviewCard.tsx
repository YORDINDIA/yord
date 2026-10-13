import Image from 'next/image';
import clsx from 'clsx';
import { ExternalLink, ImageIcon } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { storefrontOrigin } from '@/lib/storefront-origin';
import { formatCurrency } from '@/lib/utils/format';
import styles from './products.module.css';

/**
 * Storefront preview for the product side rail.
 *
 * Server component: it renders static markup and reads `NEXT_PUBLIC_APP_URL`
 * at request time through `storefrontOrigin()` to build the product link. The
 * helper suppresses the link when the configured origin is the admin's own
 * (in dev both apps serve :3000, so the link would open the admin's
 * `/products/<handle>`, which is not-found) or unset — the path is then shown
 * as plain text rather than a link to somewhere that does not exist.
 */
export default async function ProductPreviewCard({
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
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? '';
  const origin = await storefrontOrigin();
  const path = product.handle ? `/products/${product.handle}` : null;
  const href = origin && path ? `${origin}${path}` : null;
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
            title={
              path
                ? configured
                  ? 'The admin and the storefront share this origin, so there is nothing to open from here'
                  : 'Set NEXT_PUBLIC_APP_URL to open the storefront'
                : undefined
            }
          >
            {path ?? 'No handle yet'}
          </span>
        )}
      </div>
    </div>
  );
}
