'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { saveAiDraftAction } from '@/server/actions/ai';
import { aiBlogDraftSchema, aiBlogSaveSchema } from '@/lib/validation';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { postJson } from '@/lib/utils/post-json';

/**
 * AI blog research and draft save.
 *
 * The save previously ran through `POST /api/ai/blog/save`, which inserted into
 * `articles` with no audit entry, no shared schema, and no HTML sanitization on
 * two columns the storefront renders with `dangerouslySetInnerHTML`. It now calls
 * `saveAiDraftAction` directly, so the same rules apply whether the write
 * originates here or from the route.
 */
export default function AiBlogStudio() {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [draft, setDraft] = useState('');
  const [summary, setSummary] = useState('');
  const [citations, setCitations] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function generate() {
    const parsed = aiBlogDraftSchema.safeParse({ topic, keywords });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? 'Enter a topic first.', 'error');
      return;
    }

    setGenerating(true);
    const result = await postJson<{
      body_html?: string;
      summary_html?: string;
      citations?: string[];
    }>('/api/ai/blog', parsed.data, 'Failed to generate.');
    setGenerating(false);
    if (!result.ok) {
      toast(result.message, 'error');
      return;
    }
    const { data } = result;
    // The model returns untyped JSON: a non-string citation (e.g. `[{}]`)
    // passes the route's body_html-only check and throws inside the preview
    // list, so keep strings only. Same for the HTML fields below.
    setDraft(typeof data.body_html === 'string' ? data.body_html : '');
    setSummary(typeof data.summary_html === 'string' ? data.summary_html : '');
    setCitations(
      Array.isArray(data.citations)
        ? data.citations.filter((citation): citation is string => typeof citation === 'string')
        : [],
    );
    toast('Draft generated. Review it before saving.', 'success');
  }

  async function saveDraft() {
    const parsed = aiBlogSaveSchema.safeParse({
      topic,
      summary_html: summary,
      body_html: draft,
      tags: keywords,
      citations,
    });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? 'The draft payload was invalid.', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await saveAiDraftAction({ status: 'idle' }, parsed.data);
      if (result.status === 'error') {
        toast(result.formError ?? 'Failed to save the draft.', 'error');
        return;
      }
      toast(result.message ?? 'Draft saved (unpublished).', 'success');
    } catch {
      toast('Network error, try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="form-grid">
        <div>
          <label className="helper" htmlFor="ai-topic">
            Topic
          </label>
          <input
            className="input"
            id="ai-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>
        <div>
          <label className="helper" htmlFor="ai-keywords">
            Keywords
          </label>
          <input
            className="input"
            id="ai-keywords"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </div>
        <button className="button primary" type="button" onClick={generate} disabled={generating} aria-busy={generating}>
          {generating ? 'Generating…' : 'Generate Draft'}
        </button>
      </div>

      {draft && (
        <div style={{ marginTop: 16 }}>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <span className="helper">Draft preview · review before publishing.</span>
            <button className="button" type="button" onClick={saveDraft} disabled={saving} aria-busy={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
          <div className="helper">Summary</div>
          {/*
            Sanitized at render, not only on save. The summary and draft are raw
            model output, and the `saveAiDraftAction` sanitizer only runs when
            the admin clicks Save Draft — so the preview itself would execute any
            script the model emitted, on the admin origin, with no click needed
            beyond generating.
          */}
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(summary) }} />
          {citations.length > 0 && (
            <>
              <div className="helper" style={{ marginTop: 12 }}>
                Citations
              </div>
              <ul className="helper">
                {citations.map((citation, index) => (
                  <li key={index}>{citation}</li>
                ))}
              </ul>
            </>
          )}
          <div className="helper" style={{ marginTop: 12 }}>
            Body
          </div>
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(draft) }} />
        </div>
      )}
    </>
  );
}
