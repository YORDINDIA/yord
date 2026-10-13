import { Skeleton } from '@/features/ui/Skeleton';
import { Container } from '@/features/ui/Container';

export default function ArtistLoading() {
  return (
    <div tabIndex={-1} className="min-h-screen bg-scrim">
      <Skeleton variant="hero" />
      <Container className="py-12">
        <Skeleton variant="product-grid" count={8} />
      </Container>
    </div>
  );
}
