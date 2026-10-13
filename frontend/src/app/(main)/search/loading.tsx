import { Skeleton } from '@/features/ui/Skeleton';
import { Container } from '@/features/ui/Container';

/** `/search` — query header plus the result grid. */
export default function SearchLoading() {
  return (
    <div tabIndex={-1} className="flex-1 bg-surface-page pt-24 pb-16">
      <Container>
        <Skeleton variant="text-block" className="max-w-md mb-12" />
        <Skeleton variant="product-grid" count={8} />
      </Container>
    </div>
  );
}
