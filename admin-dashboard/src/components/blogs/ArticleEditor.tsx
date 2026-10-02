'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { updateArticleAction } from '@/server/actions/blogs';
import type { Article } from '@yord/db-types';

/**
 * Article editor.
 *
 * This was the third article writer, and the only one that sanitized nothing
 * while writing two columns that are rendered with `dangerouslySetInnerHTML`.
 * It now uses `updateArticleAction`, which is the same audited path the blog
 * page and the AI save route use.
 */
export default function ArticleEditor({ article }: { article: Article }) {
  const { state, pending, formAction, errorFor } = useActionForm(updateArticleAction);

  return (
    <form action={formAction} className="form-grid" noValidate>
      <input type="hidden" name="id" value={article.id} />

      <FormError state={state} />

      <ActionField name="title" label="Title" state={state}>
        <input
          className="input"
          id="title"
          name="title"
          defaultValue={article.title || ''}
          aria-invalid={Boolean(errorFor('title'))}
        />
      </ActionField>

      <ActionField name="handle" label="Handle" state={state}>
        <input
          className="input"
          id="handle"
          name="handle"
          defaultValue={article.handle || ''}
          aria-invalid={Boolean(errorFor('handle'))}
        />
      </ActionField>

      <ActionField name="author" label="Author" state={state}>
        <input className="input" id="author" name="author" defaultValue={article.author || ''} />
      </ActionField>

      <ActionField name="tags" label="Tags" state={state}>
        <input className="input" id="tags" name="tags" defaultValue={article.tags || ''} />
      </ActionField>

      <div>
        <label className="helper" htmlFor="published">
          Published
        </label>
        <input
          id="published"
          type="checkbox"
          name="published"
          defaultChecked={article.published ?? false}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="summary_html" label="Summary" state={state}>
          <textarea
            className="textarea"
            id="summary_html"
            name="summary_html"
            rows={4}
            defaultValue={article.summary_html || ''}
          />
        </ActionField>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="body_html" label="Body HTML" state={state}>
          <textarea
            className="textarea"
            id="body_html"
            name="body_html"
            rows={10}
            defaultValue={article.body_html || ''}
            aria-invalid={Boolean(errorFor('body_html'))}
          />
        </ActionField>
      </div>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save Article'}
      </button>
    </form>
  );
}
