import { Skeleton } from '@/components/ui/Skeleton';

export default function MainLoading() {
  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <Skeleton variant="hero" className="mb-12" />
        <ProductGridFallback />
      </div>
    </main>
  );
}

function ProductGridFallback() {
  return <Skeleton variant="grid" count={8} />;
}
