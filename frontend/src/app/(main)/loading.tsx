import { Skeleton } from '@/features/ui/Skeleton';
import { Container } from '@/features/ui/Container';

/**
 * Fallback for every `(main)` route that does not define its own — about,
 * contact, faq, the policies, cart, checkout, account, blog, concerts, and so
 * on. It used to be a hero plus eight product cards, so a text page (and
 * `/checkout`) flashed a product grid it would never render, with 32
 * `animate-pulse` divs.
 *
 * `flex-1`, not `min-h-screen`: this sits in a `flex-grow` column that already
 * has an 80px header above it and the footer below, so `min-h-screen` pushed
 * the footer past the fold on every loading frame.
 *
 * Catalog-shaped routes (`/products`, `/collections`, `/search`) have their own
 * grid fallbacks.
 */
export default function MainLoading() {
  return (
    <div tabIndex={-1} className="flex-1 bg-surface-page pt-24 pb-16">
      <Container>
        <div className="max-w-2xl">
          <Skeleton variant="text-block" />
        </div>
      </Container>
    </div>
  );
}
