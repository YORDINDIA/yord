'use client';

import { useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PHProvider } from '@/providers/PostHogProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { QuizPromo } from '@/features/quiz/QuizPromo';

const PostHogPageView = dynamic(
  () => import('@/providers/PostHogPageView'),
  { ssr: false }
);

const CustomCursor = dynamic(
  () => import('@/features/ui/CustomCursor').then((mod) => mod.CustomCursor),
  { ssr: false }
);

const FINE_POINTER = '(pointer: fine)';

function subscribePointer(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * `(pointer: fine)` as an external store. The server snapshot is false, so
 * the server render and the hydration render agree; React re-renders with the
 * real value once hydrated.
 */
function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribePointer,
    () => window.matchMedia(FINE_POINTER).matches,
    () => false,
  );
}

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

  // The cursor is a fine-pointer affordance: on touch devices the component
  // renders nothing, so not rendering it at all keeps its chunk (and
  // framer-motion) from being fetched.
  const finePointer = useFinePointer();

  return (
    <PHProvider>
      {/* ThemeProvider must sit above everything that reads a colour token. */}
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <PostHogPageView />
          {finePointer && <CustomCursor />}
          {children}
          {/* The Aura quiz pop-up. It decides for itself whether to appear —
              route, dwell, dismissal history — so this is the only line the rest
              of the app needs. See `features/quiz/useQuizGate.ts`. */}
          <QuizPromo />
        </QueryClientProvider>
      </ThemeProvider>
    </PHProvider>
  );
}
