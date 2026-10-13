import { Skeleton } from '@/features/ui/Skeleton';

export default function AuthLoading() {
  return (
    <div tabIndex={-1} className="min-h-[60vh] bg-surface-page px-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Skeleton variant="text-block" />
      </div>
    </div>
  );
}
