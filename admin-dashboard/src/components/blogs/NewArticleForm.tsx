'use client';

import { useRef } from 'react';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
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

      <ActionField name="title" label="Article Title" state={state}>
        <input
          className="input"
          id="title"
          name="title"
          aria-invalid={Boolean(errorFor('title'))}
        />
      </ActionField>

      <ActionField name="handle" label="Handle" state={state}>
        <input className="input" id="handle" name="handle" aria-invalid={Boolean(errorFor('handle'))} />
      </ActionField>

      <ActionField name="author" label="Author" state={state}>
        <input className="input" id="author" name="author" defaultValue="YORD Team" />
      </ActionField>

      <ActionField name="tags" label="Tags" state={state}>
        <input className="input" id="tags" name="tags" />
      </ActionField>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="summary_html" label="Summary" state={state}>
          <textarea className="textarea" id="summary_html" name="summary_html" rows={3} />
        </ActionField>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <ActionField name="body_html" label="Body HTML" state={state}>
          <textarea
            className="textarea"
            id="body_html"
            name="body_html"
            rows={6}
            aria-invalid={Boolean(errorFor('body_html'))}
          />
        </ActionField>
      </div>

      <button className="button" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Creating…' : 'Create Draft'}
      </button>
    </form>
  );
}
