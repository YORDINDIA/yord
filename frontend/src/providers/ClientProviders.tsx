'use client';

import dynamic from 'next/dynamic';
import { PHProvider } from '@/providers/PostHogProvider';

const PostHogPageView = dynamic(
  () => import('@/providers/PostHogPageView'),
  { ssr: false }
);

const CustomCursor = dynamic(
  () => import('@/components/ui/CustomCursor').then((mod) => mod.CustomCursor),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider>
      <PostHogPageView />
      <CustomCursor />
      {children}
    </PHProvider>
  );
}
