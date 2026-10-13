import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@yord/ui';
import { Hanger } from './Glyphs';

interface HungCardProps {
  handle: string;
  title: string;
  artist: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  sizes: string;
  priority?: boolean;
}

/** A product hung from a hanger on a DOM rail. Swings on hover, never lifts. */
export function HungCard({ handle, title, artist, price, compareAtPrice, image, sizes, priority }: HungCardProps) {
  const onSale = compareAtPrice !== null && compareAtPrice > price;
  return (
    <Link href={`/product/${handle}`} className="rl-hung">
      <span className="rl-hung__swing">
        <Hanger className="rl-hung__hanger" />
        <span className="rl-hung__cloth">
          <Image
            src={image || '/placeholder-product.png'}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className="rl-hung__img"
          />
        </span>
      </span>
      <span className="rl-hung__meta">
        <span className="rl-hung__title">{title}</span>
        <span className="rl-hung__artist">{artist}</span>
        <span className="rl-hung__price">
          {formatPrice(price)}
          {onSale && <s className="rl-hung__was">{formatPrice(compareAtPrice)}</s>}
        </span>
      </span>
    </Link>
  );
}
