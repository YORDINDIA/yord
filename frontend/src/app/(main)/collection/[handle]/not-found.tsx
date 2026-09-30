import { NotFoundView } from '@/features/ui/NotFoundView';

export default function CollectionNotFound() {
  return (
    <NotFoundView
      title="Collection not found"
      message="This collection does not exist or is no longer published."
    />
  );
}
