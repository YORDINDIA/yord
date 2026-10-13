import { Skeleton } from '@/features/ui/Skeleton';
import { Container } from '@/features/ui/Container';

export default function ProductLoading() {
  return (
    <div tabIndex={-1} className="bg-surface-page pt-20">
      <Container className="py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          <Skeleton variant="product-card" />
          <Skeleton variant="text-block" />
        </div>
      </Container>
    </div>
  );
}
