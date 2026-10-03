import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Megaphone } from 'lucide-react';
import AiMarketingStudio from '@/components/ai/AiMarketingStudio';
import PageHeader from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'AI Marketing · YORD Admin' };

/**
 * Marketing ops generator.
 *
 * This route used to be one `'use client'` file, which cannot export
 * `metadata`. The split keeps the header and the document title on the server
 * and hands the interactive half (brief, templates, generation) to
 * `AiMarketingStudio`, behind a `Suspense` boundary whose fallback matches the
 * two cards the studio renders.
 */
export default function AiMarketingPage() {
  return (
    <>
      <PageHeader
        icon={Megaphone}
        title="AI marketing"
        description="Turn a short brief into a campaign plan, SEO angles and copy you can paste."
      />
      <Suspense
        fallback={
          <div className="stack" aria-busy="true" aria-live="polite">
            <div className="card" aria-hidden="true">
              <div className="card-header">
                <span className="skeleton skeleton-title" style={{ width: 120 }} />
              </div>
              <span className="skeleton" style={{ height: 96, borderRadius: 10 }} />
              <div className="row" style={{ marginTop: 10 }}>
                <span className="skeleton" style={{ height: 24, width: 110, borderRadius: 8 }} />
                <span className="skeleton" style={{ height: 24, width: 90, borderRadius: 8 }} />
                <span className="skeleton" style={{ height: 24, width: 120, borderRadius: 8 }} />
              </div>
            </div>
            <div className="card" aria-hidden="true">
              <div className="card-header">
                <span className="skeleton skeleton-title" style={{ width: 140 }} />
              </div>
              <span className="skeleton" style={{ height: 160, borderRadius: 10 }} />
            </div>
            <span className="sr-only">Loading the AI marketing studio…</span>
          </div>
        }
      >
        <AiMarketingStudio />
      </Suspense>
    </>
  );
}
