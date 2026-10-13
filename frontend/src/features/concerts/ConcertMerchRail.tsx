import type { TransformedProductWithSource } from '@yord/db-types';
import type { Concert } from '@/lib/data/concerts';
import { ProductCard } from '@/features/ui/ProductCard';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { CtaLink } from '@/features/ui/CtaLink';

export interface ConcertMerchRailProps {
  concert: Concert;
  products: TransformedProductWithSource[];
}

/**
 * Merch for one show.
 *
 * Two outcomes, both honest: with products, the artist's live pieces; without,
 * a written merchandise guide. The route degrades a *failed* product read to
 * the same empty list as "this artist has no live products", which is
 * deliberate — a failure must not render "no products" copy, and the guide is
 * static content that is true either way. The failure itself is logged by the
 * query layer.
 */
export function ConcertMerchRail({ concert, products }: ConcertMerchRailProps) {
  if (products.length === 0) {
    return (
      <section className="container-page pb-12">
        <div className="bg-surface-card/50 border border-border-default p-8 md:p-12">
          <h2 className="font-display text-2xl text-text-primary mb-6">
            {concert.artist} Concert Merchandise Guide
          </h2>
          <div className="font-body text-text-muted space-y-4 text-sm leading-relaxed">
            <p>
              Looking for {concert.artist} merchandise for the {concert.tourName}? YORD India offers
              exclusive, premium fan-made designs that let you commemorate your concert experience.
              Our {concert.artist} collection features t-shirts, hoodies, and accessories inspired
              by the artist&apos;s iconic aesthetic.
            </p>
            <p>
              Whether you are planning to attend the show at{' '}
              {concert.venue !== 'TBA' ? `${concert.venue} in ` : ''}
              {concert.city}, wearing concert merchandise is the best way to show your love for{' '}
              {concert.artist}. Our designs are printed on premium-quality fabric, ensuring comfort
              and durability.
            </p>
            <p>
              Shop the complete {concert.artist} collection at YORD India with free shipping on
              every order and pan-India delivery. All products come with easy returns and
              exchanges.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="container-page pb-12">
      <SectionHeading
        eyebrow="WEAR IT TO THE SHOW"
        title={`Shop ${concert.artist} merch`}
        action={
          <CtaLink href={`/artist/${concert.artistHandle}`} variant="ghost" size="sm">
            View all
          </CtaLink>
        }
        className="mb-6"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            handle={product.handle}
            title={product.title}
            artist={product.artist}
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            image={product.image}
            badge={product.badge}
            accentColor={product.accentColor}
            product={product.originalProduct}
          />
        ))}
      </div>
    </section>
  );
}
