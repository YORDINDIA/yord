import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { conceptsEnabled } from '@/features/concepts/gate';
import { ConceptProviders } from '@/features/concepts/ConceptProviders';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ConceptsLayout({ children }: { children: React.ReactNode }) {
  if (!conceptsEnabled) notFound();
  return <ConceptProviders>{children}</ConceptProviders>;
}
