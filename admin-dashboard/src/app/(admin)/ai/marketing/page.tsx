'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { aiMarketingSchema } from '@/lib/validation';
import { postJson } from '@/lib/utils/post-json';

/**
 * Marketing ops generator.
 *
 * The only change here is that the brief is checked with the same
 * `aiMarketingSchema` the route validates with, and failures raise a toast
 * instead of rendering a bare message card at the bottom of the page. The route
 * still re-validates, so this is fast feedback, not the boundary.
 */
export default function AiMarketingPage() {
  const [brief, setBrief] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function generate() {
    const parsed = aiMarketingSchema.safeParse({ brief });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? 'Enter a brief first.', 'error');
      return;
    }

    setLoading(true);
    const result = await postJson<{ output?: string }>(
      '/api/ai/marketing',
      parsed.data,
      'Failed to generate.',
    );
    setLoading(false);
    if (!result.ok) {
      toast(result.message, 'error');
      return;
    }
    setOutput(result.data.output ?? '');
    toast('Suggestions generated.', 'success');
  }

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Marketing Ops</div>
            <div className="helper">Generate campaign ideas and SEO refreshers.</div>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label className="helper" htmlFor="marketing-brief">
              Brief
            </label>
            <input
              className="input"
              id="marketing-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="e.g. Boost IPL collection sales"
            />
          </div>
          <button
            className="button primary"
            type="button"
            onClick={generate}
            disabled={loading || !brief}
            aria-busy={loading}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
      {output && (
        <div className="card">
          <div className="section-title">Suggestions</div>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{output}</pre>
        </div>
      )}
    </div>
  );
}
