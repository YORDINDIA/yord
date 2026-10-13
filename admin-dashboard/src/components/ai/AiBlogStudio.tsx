'use client';

import { useState } from 'react';
import type { ZodError } from 'zod';
import { BookOpen, Clock, PenLine, RefreshCw, Save } from 'lucide-react';
import CopyButton from './CopyButton';
import GeneratingLines from './GeneratingLines';
import InlineError, { InlineSuccess } from './InlineError';
import styles from './ai.module.css';
import { FormActions, FormSection } from '@/components/forms/ActionForm';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { saveAiDraftAction } from '@/server/actions/ai';
import { aiBlogDraftSchema, aiBlogSaveSchema } from '@/lib/validation';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { postJson } from '@/lib/utils/post-json';

/** `keywords` is a comma-separated tag string; chips are its parts. */
function tagChips(tags: string): string[] {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Citations are arbitrary model text: only real http(s) URLs become links. */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Tag-stripped body, for the word count and reading time only. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function issuesByField(error: ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !map[key]) map[key] = issue.message;
  }
  return map;
}

/**
 * AI blog research and draft save.
 *
 * The save previously ran through `POST /api/ai/blog/save`, which inserted into
 * `articles` with no audit entry, no shared schema, and no HTML sanitization on
 * two columns the storefront renders with `dangerouslySetInnerHTML`. It calls
 * `saveAiDraftAction` directly, so the same rules apply whether the write
 * originates here or from a route.
 *
 * The model returns untyped JSON: a non-string citation (e.g. `[{}]`) passes the
 * route's `body_html`-only check and would throw inside the preview list, so
 * every field is coerced here as well. Both HTML columns are sanitized at render
 * — the save action sanitizes again on the way into the database, but that only
 * runs after a click, and the preview must not execute model-emitted script on
 * the admin origin.
 */
export default function AiBlogStudio() {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [draft, setDraft] = useState('');
  const [summary, setSummary] = useState('');
  const [citations, setCitations] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const { toast } = useToast();

  async function generate() {
    const parsed = aiBlogDraftSchema.safeParse({ topic, keywords });
    if (!parsed.success) {
      setFieldErrors(issuesByField(parsed.error));
      setError(null);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSavedId(null);

    setGenerating(true);
    const result = await postJson<{
      body_html?: string;
      summary_html?: string;
      citations?: string[];
    }>('/api/ai/blog', parsed.data, 'Failed to generate.');
    setGenerating(false);
    if (!result.ok) {
      setError(result.message);
      setLive('Generation failed');
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
    setLive('Draft ready');
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
      setError(parsed.error.issues[0]?.message ?? 'The draft payload was invalid.');
      return;
    }

    setSaving(true);
    try {
      const result = await saveAiDraftAction({ status: 'idle' }, parsed.data);
      if (result.status === 'error') {
        setError(result.formError ?? 'Failed to save the draft.');
        return;
      }
      const id = result.data?.id ?? null;
      setError(null);
      setSavedId(id);
      setLive(id ? `Draft #${id} saved, unpublished` : 'Draft saved, unpublished');
      toast(result.message ?? 'Draft saved (unpublished).', 'success');
    } catch {
      setError('Network error, try again.');
    } finally {
      setSaving(false);
    }
  }

  const text = plainText(draft);
  const words = text ? text.split(' ').length : 0;
  const minutes = Math.max(1, Math.round(words / 200));
  const chips = tagChips(keywords);

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-title">1 · Research brief</div>
            <div className="helper">
              Agnes writes a draft from the topic and treats the keywords as data, not instructions.
            </div>
          </div>
        </div>

        <FormSection title="Brief" icon={PenLine}>
          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="ai-topic">
                Topic
              </label>
              <input
                className="input"
                id="ai-topic"
                value={topic}
                maxLength={500}
                aria-invalid={fieldErrors.topic ? true : undefined}
                aria-describedby={fieldErrors.topic ? 'ai-topic-error' : undefined}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. Coldplay India tour merchandise guide"
              />
              {fieldErrors.topic && (
                <div className="field-error" id="ai-topic-error" role="alert">
                  {fieldErrors.topic}
                </div>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor="ai-keywords">
                Keywords
              </label>
              <input
                className="input"
                id="ai-keywords"
                value={keywords}
                maxLength={500}
                aria-invalid={fieldErrors.keywords ? true : undefined}
                aria-describedby={fieldErrors.keywords ? 'ai-keywords-error' : 'ai-keywords-hint'}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="coldplay, tour merch, india"
              />
              {fieldErrors.keywords ? (
                <div className="field-error" id="ai-keywords-error" role="alert">
                  {fieldErrors.keywords}
                </div>
              ) : (
                <div className="field-hint" id="ai-keywords-hint">
                  Comma-separated. Becomes the draft&apos;s tags.
                </div>
              )}
            </div>
          </div>

          <FormActions>
            <button
              className="button primary"
              type="button"
              onClick={generate}
              disabled={generating}
              aria-busy={generating}
            >
              {generating ? 'Generating…' : draft ? 'Regenerate draft' : 'Generate draft'}
            </button>
          </FormActions>
        </FormSection>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-title">2 · Draft</div>
            <div className="helper">
              Review it here. Saving creates an <span className="mono">articles</span> row that stays
              unpublished until you publish it in Content.
            </div>
          </div>
          {draft && (
            <div className="row">
              <StatusBadge value="draft" label="Unpublished" dot />
              <span className="helper num row" style={{ gap: 4 }}>
                <Clock size={11} aria-hidden />
                {words} words · {minutes} min read
              </span>
            </div>
          )}
        </div>

        {error && <InlineError message={error} />}
        {savedId !== null && (
          <InlineSuccess
            message={`Draft #${savedId} saved as unpublished. Find it under Content → blogs.`}
          />
        )}

        {generating && (
          <GeneratingLines label="Researching and writing the draft — the slowest call in the admin." />
        )}

        {!generating && !draft && (
          <EmptyState
            icon={<BookOpen size={22} />}
            title="No draft yet"
            hint="Enter a topic and generate. Nothing is written to the database until you press Save draft."
          />
        )}

        {!generating && draft && (
          <div className="stack-sm">
            <div className={styles.artefact}>
              <span className="helper-strong">Summary</span>
              <CopyButton value={summary} ariaLabel="Copy summary HTML" />
            </div>
            {summary ? (
              <div
                className="prose-admin"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(summary) }}
              />
            ) : (
              <span className="helper">The model returned no summary.</span>
            )}

            <div className={styles.artefact} style={{ marginTop: 8 }}>
              <span className="helper-strong">Tags</span>
              <CopyButton value={keywords} ariaLabel="Copy tags" />
            </div>
            {chips.length > 0 ? (
              <div className="tag-list">
                {chips.map((chip) => (
                  <span key={chip} className="chip tone tone-saffron">
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <span className="helper">No keywords given, so the draft will save without tags.</span>
            )}

            <div className={styles.artefact} style={{ marginTop: 8 }}>
              <span className="helper-strong">Body</span>
              <div className="row">
                <CopyButton value={draft} ariaLabel="Copy body HTML" />
                <button
                  className="button small"
                  type="button"
                  onClick={generate}
                  disabled={generating || saving}
                >
                  <RefreshCw size={13} aria-hidden /> Regenerate
                </button>
              </div>
            </div>
            {/* Sanitized at render, not only on save: this is raw model output
                on the admin origin, and the save action's sanitizer only runs
                once the admin clicks Save draft. */}
            <div
              className="prose-admin"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(draft) }}
            />

            {citations.length > 0 && (
              <>
                <div className={styles.artefact} style={{ marginTop: 8 }}>
                  <span className="helper-strong">Citations</span>
                  <CopyButton value={citations.join('\n')} ariaLabel="Copy citations" />
                </div>
                <ol className={styles.citations}>
                  {citations.map((citation, index) => (
                    <li key={`${index}-${citation.slice(0, 40)}`}>
                      {isHttpUrl(citation) ? (
                        <a href={citation} target="_blank" rel="noreferrer">
                          {citation}
                        </a>
                      ) : (
                        citation
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}

            <FormActions>
              <span className="helper">
                Saves summary, body, tags and citations; nothing is published.
              </span>
              <button
                className="button primary"
                type="button"
                onClick={saveDraft}
                disabled={saving}
                aria-busy={saving}
              >
                <Save size={13} aria-hidden /> {saving ? 'Saving…' : 'Save draft'}
              </button>
            </FormActions>
          </div>
        )}
      </section>
    </>
  );
}
