import { Skeleton } from '@/components/ui/Skeleton';

export default function CollectionLoading() {
  return (
    <main className="min-h-screen bg-noir-950 pt-20">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <Skeleton variant="hero" className="mb-12" />
        <Skeleton variant="grid" count={8} />
      </div>
    </main>
  );
}
