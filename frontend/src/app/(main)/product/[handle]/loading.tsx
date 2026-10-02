import { Skeleton } from '@/features/ui/Skeleton';

export default function ProductLoading() {
  return (
    <main className="bg-surface-page pt-20">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          <Skeleton variant="card" />
          <Skeleton variant="text" />
        </div>
      </div>
    </main>
  );
}
