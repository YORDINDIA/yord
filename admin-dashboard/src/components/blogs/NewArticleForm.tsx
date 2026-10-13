'use client';

import { useRef } from 'react';
import { FilePlus2, FileText } from 'lucide-react';
import {
  FormActions,
  FormError,
  FormSection,
  useActionForm,
} from '@/components/forms/ActionForm';
import { createArticleAction } from '@/server/actions/blogs';

/**
 * Create-article form for a blog.
 *
 * The old inline `createArticle` returned early for a missing title or a failed
 * insert, so a rejected draft looked identical to a created one. It also wrote
 * `body_html`/`summary_html` unsanitized even though both are rendered with
 * `dangerouslySetInnerHTML`; `createArticleAction` sanitizes them.
 *
 * Unique ids (`article-*`): this form renders below BlogEditor on the same
 * page, which already owns `title`/`handle`/`tags`. Sharing those ids made
 * these labels focus the blog controls. `ActionField` renders
 * `htmlFor={name}`, so it cannot point at a prefixed id — `DraftField` below
 * replicates its markup (label + control + `field-error`) with matching ids.
 * Field names are unchanged: `blog_id`, `title`, `handle`, `author`, `tags`,
 * `summary_html`, `body_html`.
 */
function DraftField({
  name,
  label,
  controlId,
  message,
  hint,
  children,
}: {
  name: string;
  label: string;
  /** Overrides the generated `article-<name>` id (readable ids for HTML fields). */
  controlId?: string;
  message?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = controlId ?? `article-${name}`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {message ? (
        <div className="field-error" id={`${id}-error`} role="alert">
          {message}
        </div>
      ) : (
        hint && <div className="field-hint">{hint}</div>
      )}
    </div>
  );
}

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
    <form ref={formRef} action={formAction} className="stack" noValidate>
      <input type="hidden" name="blog_id" value={blogId} />

      <FormError state={state} />

      <FormSection
        title="New draft"
        icon={FilePlus2}
        description="Drafts are created unpublished — publish from the article editor once it is ready."
      >
        <div className="grid-2">
          <DraftField name="title" label="Title" message={errorFor('title')}>
            <input
              className="input"
              id="article-title"
              name="title"
              aria-invalid={Boolean(errorFor('title'))}
              aria-describedby={errorFor('title') ? 'article-title-error' : undefined}
            />
          </DraftField>

          <DraftField
            name="handle"
            label="Handle"
            message={errorFor('handle')}
            hint="Generated from the title when left empty."
          >
            <input
              className="input mono"
              id="article-handle"
              name="handle"
              placeholder="auto-generated"
              aria-invalid={Boolean(errorFor('handle'))}
              aria-describedby={errorFor('handle') ? 'article-handle-error' : undefined}
            />
          </DraftField>
        </div>

        <div className="grid-2">
          <DraftField name="author" label="Author" message={errorFor('author')}>
            <input
              className="input"
              id="article-author"
              name="author"
              defaultValue="YORD Team"
              aria-invalid={Boolean(errorFor('author'))}
              aria-describedby={errorFor('author') ? 'article-author-error' : undefined}
            />
          </DraftField>

          <DraftField
            name="tags"
            label="Tags"
            message={errorFor('tags')}
            hint="Comma separated, up to 500 characters."
          >
            <input
              className="input"
              id="article-tags"
              name="tags"
              aria-invalid={Boolean(errorFor('tags'))}
              aria-describedby={errorFor('tags') ? 'article-tags-error' : undefined}
            />
          </DraftField>
        </div>

        <DraftField
          name="summary_html"
          controlId="article-summary"
          label="Excerpt"
          message={errorFor('summary_html')}
          hint="Shown on the blog cards; 80–160 characters reads best."
        >
          <textarea
            className="textarea"
            id="article-summary"
            name="summary_html"
            rows={3}
            aria-invalid={Boolean(errorFor('summary_html'))}
            aria-describedby={errorFor('summary_html') ? 'article-summary-error' : undefined}
          />
        </DraftField>

        <DraftField
          name="body_html"
          controlId="article-body"
          label="Body HTML"
          message={errorFor('body_html')}
        >
          <textarea
            className="textarea"
            id="article-body"
            name="body_html"
            rows={6}
            aria-invalid={Boolean(errorFor('body_html'))}
            aria-describedby={errorFor('body_html') ? 'article-body-error' : undefined}
          />
        </DraftField>
      </FormSection>

      <FormActions>
        <span className="helper">Saves a draft and keeps this form open for the next one.</span>
        <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
          <FileText size={14} aria-hidden />
          {pending ? 'Creating…' : 'Create draft'}
        </button>
      </FormActions>
    </form>
  );
}
