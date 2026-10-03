import type { Metadata } from 'next';
import { PenLine } from 'lucide-react';
import AiBlogStudio from '@/components/ai/AiBlogStudio';
import PageHeader from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'AI Blog · YORD Admin' };

/**
 * AI blog studio.
 *
 * Pure client interaction: the topic and keywords are typed here, the draft
 * comes from `POST /api/ai/blog`, and the save goes straight through
 * `saveAiDraftAction` (audited, sanitized, validated by `aiBlogSaveSchema`) —
 * the same path whether it is fired from this page or a route. Nothing is read
 * from the database on render, so the page is headers plus the studio.
 */
export default function AiBlogPage() {
  return (
    <>
      <PageHeader
        icon={PenLine}
        title="AI blog"
        description="Draft an article with citations from a topic, review it, then save it unpublished."
      />
      <AiBlogStudio />
    </>
  );
}
