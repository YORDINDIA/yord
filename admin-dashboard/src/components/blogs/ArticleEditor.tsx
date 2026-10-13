'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import Image from 'next/image';
import { AlignLeft, FileText, ImageIcon, Send, Type, UserRound } from 'lucide-react';
import {
  ActionField,
  FormActions,
  FormError,
  FormSection,
  useActionForm,
} from '@/components/forms/ActionForm';
import StatusBadge from '@/components/ui/StatusBadge';
import { updateArticleAction } from '@/server/actions/blogs';
import { formatDate } from '@/lib/utils/format';
import { sanitizeHtml, slugify } from '@/lib/utils/sanitize';
import type { Article } from '@yord/db-types';
import ArticlePreview from './ArticlePreview';
import {
  articleImageUrl,
  articlePath,
  excerptCheck,
  formatRelative,
  formatTimestamp,
  textMetrics,
} from './display';
import { useDebouncedValue } from './useDebouncedValue';
import styles from './blogs.module.css';

/** Label/value row for the side rail. */
function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row-between meta-row">
      <span className="helper">{label}</span>
      <span className="strong">{value}</span>
    </div>
  );
}

/**
 * Article editor: the form on the left, a live storefront preview on the right.
 *
 * The write path is unchanged — one `<form>` posting `id`, `title`, `handle`,
 * `author`, `tags`, `published`, `summary_html`, `body_html` to
 * `updateArticleAction`, which validates with `articleSchema` and sanitizes
 * both HTML columns. What is new is that the fields are controlled, so the
 * preview, the word count, and the excerpt guidance follow the admin's typing.
 *
 * The editor owns the `.layout-split` markup (rather than the page) because the
 * preview and the fields share state: splitting them across a server boundary
 * would mean lifting every field into a context for no gain. The preview is
 * debounced ~300ms and sanitizes on render.
 */
export default function ArticleEditor({ article }: { article: Article }) {
  const { state, pending, formAction, errorFor } = useActionForm(updateArticleAction);

  const initial = useMemo(
    () => ({
      title: article.title ?? '',
      handle: article.handle ?? '',
      author: article.author ?? '',
      tags: article.tags ?? '',
      summary: article.summary_html ?? '',
      body: article.body_html ?? '',
      published: article.published ?? false,
    }),
    [article],
  );

  const [title, setTitle] = useState(initial.title);
  const [handle, setHandle] = useState(initial.handle);
  const [author, setAuthor] = useState(initial.author);
  const [tags, setTags] = useState(initial.tags);
  const [summary, setSummary] = useState(initial.summary);
  const [body, setBody] = useState(initial.body);
  const [published, setPublished] = useState(initial.published);

  /*
   * Adopt a new server version (after a save, `revalidatePath` re-renders this
   * route and `article` arrives again) unless the admin typed something while
   * the write was in flight. Without this, a save whose sanitized body differs
   * from the textarea — the action decodes entities and drops scripts — left
   * the form claiming "Unsaved changes" right after a successful save.
   *
   * Adjusting state during render, keyed on the previous server object, is the
   * pattern `SearchInput` documents: no effect, no extra paint.
   */
  const [serverValues, setServerValues] = useState(initial);
  if (serverValues !== initial) {
    const edited =
      title !== serverValues.title ||
      handle !== serverValues.handle ||
      author !== serverValues.author ||
      tags !== serverValues.tags ||
      summary !== serverValues.summary ||
      body !== serverValues.body ||
      published !== serverValues.published;
    setServerValues(initial);
    if (!edited) {
      setTitle(initial.title);
      setHandle(initial.handle);
      setAuthor(initial.author);
      setTags(initial.tags);
      setSummary(initial.summary);
      setBody(initial.body);
      setPublished(initial.published);
    }
  }

  const debouncedBody = useDebouncedValue(body, 300);
  const debouncedSummary = useDebouncedValue(summary, 300);

  // Metrics come from the sanitized body, so the numbers describe exactly what
  // the preview (and the storefront) will render.
  const metrics = useMemo(() => textMetrics(sanitizeHtml(debouncedBody)), [debouncedBody]);
  const excerpt = useMemo(() => excerptCheck(debouncedSummary), [debouncedSummary]);

  const slug = slugify(handle || title, 'untitled');
  const coverUrl = articleImageUrl(article);
  const path = articlePath(article.handle);
  const dirty =
    title !== initial.title ||
    handle !== initial.handle ||
    author !== initial.author ||
    tags !== initial.tags ||
    summary !== initial.summary ||
    body !== initial.body ||
    published !== initial.published;

  return (
    <div className="layout-split">
      <form action={formAction} className="stack" noValidate>
        <input type="hidden" name="id" value={article.id} />

        {/* Sticky while scrolling a long body; only for real unsaved work, so
            it cannot become permanent chrome. */}
        {dirty && (
          <div className="save-bar">
            <span className="helper-strong">Unsaved changes</span>
            <button className="button small primary" type="submit" disabled={pending} aria-busy={pending}>
              {pending ? 'Saving…' : 'Save now'}
            </button>
          </div>
        )}

        <FormError state={state} />

        <FormSection title="Title & slug" icon={Type}>
          <div className="grid-2">
            <ActionField name="title" label="Title" state={state}>
              <input
                className="input"
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={Boolean(errorFor('title'))}
                aria-describedby={errorFor('title') ? 'title-error' : undefined}
              />
            </ActionField>

            <ActionField
              name="handle"
              label="Handle"
              state={state}
              hint={`Saved as ${articlePath(slug) ?? slug}`}
            >
              <input
                className="input mono"
                id="handle"
                name="handle"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="auto-generated from the title"
                aria-invalid={Boolean(errorFor('handle'))}
                aria-describedby={errorFor('handle') ? 'handle-error' : undefined}
              />
            </ActionField>
          </div>
          <div className="helper">
            Live path:{' '}
            <span className="mono">{articlePath(slug) ?? slug}</span>
            {handle.trim() === '' && ' (derived from the title until a handle is saved)'}
          </div>
        </FormSection>

        <FormSection
          title="Excerpt"
          icon={AlignLeft}
          description="Shown on the blog cards and used as the article's meta description."
        >
          <ActionField name="summary_html" label="Excerpt (HTML)" state={state}>
            <textarea
              className="textarea"
              id="summary_html"
              name="summary_html"
              rows={4}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              aria-invalid={Boolean(errorFor('summary_html'))}
              aria-describedby={errorFor('summary_html') ? 'summary_html-error' : undefined}
            />
          </ActionField>
          <div
            className={clsx(styles.metric, excerpt.state === 'good' ? styles.metricOk : styles.metricWarn)}
          >
            {excerpt.hint}
          </div>
        </FormSection>

        <FormSection
          title="Body"
          icon={FileText}
          description="Rendered with the storefront's typography; scripts and embedded frames are stripped."
        >
          <ActionField name="body_html" label="Body HTML" state={state}>
            <textarea
              className={`textarea ${styles.codeArea}`}
              id="body_html"
              name="body_html"
              rows={18}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-invalid={Boolean(errorFor('body_html'))}
              aria-describedby={errorFor('body_html') ? 'body_html-error' : undefined}
            />
          </ActionField>
          <div className="row-between">
            <span className={styles.metric}>
              {metrics.words.toLocaleString('en-IN')} words · {metrics.minutes} min read
            </span>
            <span className={`${styles.metric} num`}>
              {body.length.toLocaleString('en-IN')} / 2,00,000 characters of HTML
            </span>
          </div>
        </FormSection>

        <FormSection title="Author & tags" icon={UserRound}>
          <div className="grid-2">
            <ActionField name="author" label="Author" state={state}>
              <input
                className="input"
                id="author"
                name="author"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                aria-invalid={Boolean(errorFor('author'))}
                aria-describedby={errorFor('author') ? 'author-error' : undefined}
              />
            </ActionField>

            <ActionField
              name="tags"
              label="Tags"
              state={state}
              hint={`${tags.length} / 500 characters, comma separated`}
            >
              <input
                className="input"
                id="tags"
                name="tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                aria-invalid={Boolean(errorFor('tags'))}
                aria-describedby={errorFor('tags') ? 'tags-error' : undefined}
              />
            </ActionField>
          </div>
        </FormSection>

        <FormSection title="Publishing" icon={Send}>
          <label className="checkbox-row" htmlFor="published">
            <input
              id="published"
              type="checkbox"
              name="published"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            <span className="helper-strong">Published</span>
          </label>
          <p className="helper">
            Publishing stamps `published_at` the first time and keeps it on later saves. Unpublishing
            clears it, so the storefront stops serving the article immediately.
          </p>
        </FormSection>

        <FormActions>
          <span className="helper">
            {pending
              ? 'Saving…'
              : dirty
                ? 'Unsaved changes'
                : state.status === 'success'
                  ? state.message
                  : 'No changes since the last save'}
          </span>
          <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : 'Save article'}
          </button>
        </FormActions>
      </form>

      <aside className="side-rail">
        <div className="card">
          <div className="card-header">
            <div className="section-title">Storefront preview</div>
            <span className="chip tone tone-emerald">Sanitized</span>
          </div>
          <ArticlePreview
            title={title}
            handle={handle}
            excerpt={debouncedSummary}
            bodyHtml={debouncedBody}
            coverUrl={coverUrl}
            published={published}
            publishedAt={article.published_at}
          />
        </div>

        <div className="card">
          <div className="card-header">
            <div className="section-title">Cover</div>
          </div>
          {coverUrl ? (
            <>
              <div className={styles.previewFrame}>
                <Image src={coverUrl} alt="" fill sizes="320px" />
              </div>
              <p className="helper" style={{ marginTop: 8 }}>
                Stored on the article. This form has no cover field — the image lives in
                `storage_image_url` / `image_src`, which the migration wrote.
              </p>
            </>
          ) : (
            <div className={styles.coverEmpty}>
              <ImageIcon size={18} aria-hidden />
              <span className="helper">
                No cover image. Article cover art is not editable in the admin yet — the storefront
                falls back to the first image in the body.
              </span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="section-title">Article</div>
            <StatusBadge value={published ? 'published' : 'draft'} dot />
          </div>
          <div className="stack-sm">
            <MetaRow label="Article ID" value={<span className="mono">{article.id}</span>} />
            <MetaRow label="Blog" value={<span className="mono">{article.blog_id}</span>} />
            <MetaRow label="Handle" value={<span className="mono">{article.handle ?? '—'}</span>} />
            <MetaRow
              label="Storefront"
              value={<span className="mono">{path ?? 'no handle'}</span>}
            />
            <MetaRow
              label="Created"
              value={
                <span title={formatTimestamp(article.created_at)}>
                  {formatRelative(article.created_at)}
                </span>
              }
            />
            <MetaRow
              label="Updated"
              value={
                <span title={formatTimestamp(article.updated_at)}>
                  {formatRelative(article.updated_at)}
                </span>
              }
            />
            <MetaRow
              label="Published"
              value={
                article.published_at ? (
                  <span title={formatTimestamp(article.published_at)}>
                    {formatDate(article.published_at)}
                  </span>
                ) : (
                  'Never'
                )
              }
            />
            <MetaRow label="Reading time" value={`${metrics.minutes} min`} />
          </div>
        </div>
      </aside>
    </div>
  );
}
