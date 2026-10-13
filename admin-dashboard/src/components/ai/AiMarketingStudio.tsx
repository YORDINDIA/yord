'use client';

import { useRef, useState } from 'react';
import { Megaphone, RefreshCw, Sparkles } from 'lucide-react';
import CopyButton from './CopyButton';
import GeneratingLines from './GeneratingLines';
import InlineError from './InlineError';
import styles from './ai.module.css';
import { FormActions, FormSection } from '@/components/forms/ActionForm';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/ToastProvider';
import { aiMarketingSchema } from '@/lib/validation';
import { postJson } from '@/lib/utils/post-json';

/** Matches `aiMarketingSchema`'s max; the counter warns before the schema does. */
const MAX_BRIEF = 4_000;

/**
 * One-click starting points. Aimed at the recurring campaigns this catalogue
 * actually runs (concert drops, festival sales, restocks), so the first useful
 * brief is one click rather than a blank textarea.
 */
const TEMPLATES: { label: string; brief: string }[] = [
  {
    label: 'Festival sale',
    brief:
      'Festival sale campaign for the YORD India storefront: name the three strongest bundles in the concert-merch catalogue, give the campaign angle, banner hero copy, and five SEO tags.',
  },
  {
    label: 'New drop',
    brief:
      'New drop announcement for a Coldplay India tour collection: write the launch angle, three social captions, the banner headline, and the launch-day SEO tags.',
  },
  {
    label: 'Back in stock',
    brief:
      'Restock campaign for the best-selling t-shirts: write urgency-led email copy, a short banner line, and tags for the restock collection page.',
  },
  {
    label: 'Artist collection',
    brief:
      'Artist collection campaign for Diljit Dosanjh merch: propose the collection story, hero copy, five SEO keywords, and two cross-sell bundles from existing products.',
  },
];

/**
 * Marketing ops generator.
 *
 * The brief is checked with the same `aiMarketingSchema` the route validates
 * with, so an empty or over-long brief fails here instead of after a round trip;
 * the route still re-validates and remains the boundary. The request payload,
 * the `postJson` call, and the `{ output }` shape are unchanged.
 */
export default function AiMarketingStudio() {
  const [brief, setBrief] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  async function generate() {
    const parsed = aiMarketingSchema.safeParse({ brief });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a brief first.');
      return;
    }
    setFieldError(null);
    setError(null);

    setLoading(true);
    const result = await postJson<{ output?: string }>(
      '/api/ai/marketing',
      parsed.data,
      'Failed to generate.',
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      setLive('Generation failed');
      return;
    }
    setOutput(result.data.output ?? '');
    setLive('Campaign plan ready');
    toast('Suggestions generated.', 'success');
  }

  function applyTemplate(template: string) {
    setBrief(template);
    setFieldError(null);
    setError(null);
    setOutput('');
    textareaRef.current?.focus();
  }

  function reset() {
    setBrief('');
    setOutput('');
    setError(null);
    setFieldError(null);
    setLive('New brief started');
    textareaRef.current?.focus();
  }

  const over = brief.length > MAX_BRIEF;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-title">1 · Brief</div>
            <div className="helper">
              Describe the campaign. Agnes returns a plan you copy — nothing is written to the
              database from this studio.
            </div>
          </div>
        </div>

        <FormSection title="Campaign brief" icon={Megaphone}>
          <div className="field">
            <label className="label" htmlFor="marketing-brief">
              Brief
            </label>
            <textarea
              className="textarea"
              id="marketing-brief"
              ref={textareaRef}
              rows={5}
              value={brief}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby="marketing-brief-counter"
              onChange={(event) => {
                setBrief(event.target.value);
                setFieldError(null);
              }}
              placeholder="e.g. Boost IPL collection sales with a two-week campaign"
            />
            {fieldError && (
              <div className="field-error" role="alert">
                {fieldError}
              </div>
            )}
            {/* The counter always renders: it is the only cue before the schema
                refuses an over-long brief, and `aria-describedby` must not point
                at an element that disappears when a validation error shows. */}
            <div
              className={`${styles.counter} ${over ? styles.over : ''}`}
              id="marketing-brief-counter"
            >
              {brief.length} / {MAX_BRIEF} characters
              {over ? ' — too long, the request will be refused.' : ''}
            </div>
          </div>

          <div className={styles.templates}>
            {TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                className="button small"
                onClick={() => applyTemplate(template.brief)}
                disabled={loading}
              >
                <Sparkles size={13} aria-hidden /> {template.label}
              </button>
            ))}
          </div>

          <FormActions>
            <button
              className="button primary"
              type="button"
              onClick={generate}
              disabled={loading || !brief.trim()}
              aria-busy={loading}
            >
              {loading ? 'Generating…' : output ? 'Generate again' : 'Generate plan'}
            </button>
          </FormActions>
        </FormSection>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-title">2 · Campaign plan</div>
            <div className="helper">Plain text, formatted for pasting into a brief or a chat.</div>
          </div>
          {output && (
            <div className="row">
              <CopyButton value={output} label="Copy plan" ariaLabel="Copy campaign plan" />
              <button className="button small" type="button" onClick={reset}>
                <RefreshCw size={13} aria-hidden /> Start a new brief
              </button>
            </div>
          )}
        </div>

        {error && <InlineError message={error} />}

        {loading && <GeneratingLines label="Agnes is drafting the plan…" />}

        {!loading && !output && (
          <EmptyState
            icon={<Megaphone size={22} />}
            title="No plan yet"
            hint="Write a brief — or start from a template — and the campaign plan lands here."
          />
        )}

        {!loading && output && <div className={styles.output}>{output}</div>}
      </section>
    </>
  );
}
