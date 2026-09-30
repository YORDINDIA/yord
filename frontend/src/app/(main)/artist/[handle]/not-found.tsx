import { NotFoundView } from '@/features/ui/NotFoundView';

export default function ArtistNotFound() {
  return (
    <NotFoundView
      title="Artist not found"
      message="This artist does not have a collection on YORD India yet."
    />
  );
}
