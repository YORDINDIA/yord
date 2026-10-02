import { NotFoundView } from '@/features/ui/NotFoundView';

export default function ProductNotFound() {
  return (
    <NotFoundView
      title="Product not found"
      message="This product does not exist or is no longer available."
    />
  );
}
