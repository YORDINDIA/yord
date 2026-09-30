'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PHProvider } from '@/providers/PostHogProvider';

const PostHogPageView = dynamic(
  () => import('@/providers/PostHogPageView'),
  { ssr: false }
);

const CustomCursor = dynamic(
  () => import('@/features/ui/CustomCursor').then((mod) => mod.CustomCursor),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  // One client per browser session (useState initializer, never recreated).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Catalog pages revalidate server-side; client refetch on focus
            // would discard SSR HTML for no benefit.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return (
    <PHProvider>
      <QueryClientProvider client={queryClient}>
        <PostHogPageView />
        <CustomCursor />
        {children}
      </QueryClientProvider>
    </PHProvider>
  );
}
