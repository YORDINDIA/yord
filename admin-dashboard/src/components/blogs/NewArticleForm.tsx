'use client';

import { useRef } from 'react';
import { useActionForm, FormError } from '@/components/forms/ActionForm';
import { createArticleAction } from '@/server/actions/blogs';

/**
 * Create-article form.
 *
 * The old inline `createArticle` returned early for a missing title or a failed
 * insert, so a rejected draft looked identical to a created one. It also wrote
 * `body_html`/`summary_html` unsanitized even though both are rendered with
 * `dangerouslySetInnerHTML`; `createArticleAction` sanitizes them.
 */
export default function NewArticleForm({ blogId }: { blogId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, formAction, errorFor } = useActionForm<{ id: number }>(
    createArticleAction,
    {
      onResult: (result) => {
        // Clear the draft fields so the next article does not start as a copy of
        // this one. `reset()` restores defaults: the empty inputs clear, and the
        // hidden `blog_id` keeps its `value` attribute.
        if (result.status === 'success') formRef.current?.reset();
      },
    },
  );

  return (
    <form ref={formRef} action={formAction} className="form-grid" style={{ marginTop: 16 }} noValidate>
      <input type="hidden" name="blog_id" value={blogId} />

      <FormError state={state} />

      {/*
        Unique ids (`article-*`): this form renders below BlogEditor on the same
        page, which already uses `title`/`handle`/`tags`. Sharing those ids made
        these labels focus the blog controls. `ActionField` renders
        `htmlFor={name}`, so it cannot point at a prefixed id — these blocks
        replicate its markup (label + control + `field-error`) with matching
        ids instead.
      */}
      <div>
        <label className="helper" htmlFor="article-title">
          Article Title
        </label>
        <input
          className="input"
          id="article-title"
          name="title"
          aria-invalid={Boolean(errorFor('title'))}
          aria-describedby={errorFor('title') ? 'article-title-error' : undefined}
        />
        {errorFor('title') && (
          <div className="field-error" id="article-title-error" role="alert">
            {errorFor('title')}
          </div>
        )}
      </div>

      <div>
        <label className="helper" htmlFor="article-handle">
          Handle
        </label>
        <input
          className="input"
          id="article-handle"
          name="handle"
          aria-invalid={Boolean(errorFor('handle'))}
          aria-describedby={errorFor('handle') ? 'article-handle-error' : undefined}
        />
        {errorFor('handle') && (
          <div className="field-error" id="article-handle-error" role="alert">
            {errorFor('handle')}
          </div>
        )}
      </div>

      <div>
        <label className="helper" htmlFor="article-author">
          Author
        </label>
        <input
          className="input"
          id="article-author"
          name="author"
          defaultValue="YORD Team"
          aria-invalid={Boolean(errorFor('author'))}
          aria-describedby={errorFor('author') ? 'article-author-error' : undefined}
        />
        {errorFor('author') && (
          <div className="field-error" id="article-author-error" role="alert">
            {errorFor('author')}
          </div>
        )}
      </div>

      <div>
        <label className="helper" htmlFor="article-tags">
          Tags
        </label>
        <input
          className="input"
          id="article-tags"
          name="tags"
          aria-invalid={Boolean(errorFor('tags'))}
          aria-describedby={errorFor('tags') ? 'article-tags-error' : undefined}
        />
        {errorFor('tags') && (
          <div className="field-error" id="article-tags-error" role="alert">
            {errorFor('tags')}
          </div>
        )}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <label className="helper" htmlFor="article-summary">
          Summary
        </label>
        <textarea
          className="textarea"
          id="article-summary"
          name="summary_html"
          rows={3}
          aria-invalid={Boolean(errorFor('summary_html'))}
          aria-describedby={errorFor('summary_html') ? 'article-summary-error' : undefined}
        />
        {errorFor('summary_html') && (
          <div className="field-error" id="article-summary-error" role="alert">
            {errorFor('summary_html')}
          </div>
        )}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <label className="helper" htmlFor="article-body">
          Body HTML
        </label>
        <textarea
          className="textarea"
          id="article-body"
          name="body_html"
          rows={6}
          aria-invalid={Boolean(errorFor('body_html'))}
          aria-describedby={errorFor('body_html') ? 'article-body-error' : undefined}
        />
        {errorFor('body_html') && (
          <div className="field-error" id="article-body-error" role="alert">
            {errorFor('body_html')}
          </div>
        )}
      </div>

      <button className="button" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Creating…' : 'Create Draft'}
      </button>
    </form>
  );
}
