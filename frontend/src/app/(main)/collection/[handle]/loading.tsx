import { Skeleton } from '@/features/ui/Skeleton';
import { Container } from '@/features/ui/Container';

export default function CollectionLoading() {
  return (
    <div tabIndex={-1} className="min-h-screen bg-surface-page pt-20">
      <Container className="py-12">
        <Skeleton variant="hero" className="mb-12" />
        <Skeleton variant="product-grid" count={8} />
      </Container>
    </div>
  );
}
