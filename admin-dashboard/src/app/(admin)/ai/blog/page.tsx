import type { Metadata } from 'next';
import AiBlogStudio from '@/components/ai/AiBlogStudio';

export const metadata: Metadata = { title: 'AI Blog · YORD Admin' };

export default function AiBlogPage() {
  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">AI Blog Research</div>
            <div className="helper">Generates a draft with citations.</div>
          </div>
        </div>
        <AiBlogStudio />
      </div>
    </div>
  );
}
