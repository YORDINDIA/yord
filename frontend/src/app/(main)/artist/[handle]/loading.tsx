import { Skeleton } from '@/features/ui/Skeleton';

export default function ArtistLoading() {
  return (
    <main className="min-h-screen bg-noir-950">
      <Skeleton variant="hero" />
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <Skeleton variant="grid" count={8} />
      </div>
    </main>
  );
}
