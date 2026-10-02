import { Skeleton } from '@/features/ui/Skeleton';

export default function AuthLoading() {
  return (
    <main className="min-h-[60vh] bg-surface-page px-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Skeleton variant="text" />
      </div>
    </main>
  );
}
