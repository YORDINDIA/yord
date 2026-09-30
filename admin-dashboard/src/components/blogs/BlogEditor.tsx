'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { updateBlogAction } from '@/server/actions/blogs';
import type { Blog } from '@yord/db-types';

/** Blog metadata editor, bound to the audited `updateBlogAction`. */
export default function BlogEditor({ blog }: { blog: Blog }) {
  const { state, pending, formAction, errorFor } = useActionForm(updateBlogAction);

  return (
    <form action={formAction} className="form-grid" noValidate>
      <input type="hidden" name="id" value={blog.id} />

      <FormError state={state} />

      <ActionField name="title" label="Title" state={state}>
        <input
          className="input"
          id="title"
          name="title"
          defaultValue={blog.title || ''}
          aria-invalid={Boolean(errorFor('title'))}
        />
      </ActionField>

      <ActionField name="handle" label="Handle" state={state}>
        <input
          className="input"
          id="handle"
          name="handle"
          defaultValue={blog.handle || ''}
          aria-invalid={Boolean(errorFor('handle'))}
        />
      </ActionField>

      <ActionField name="tags" label="Tags" state={state}>
        <input
          className="input"
          id="tags"
          name="tags"
          defaultValue={blog.tags || ''}
          aria-invalid={Boolean(errorFor('tags'))}
        />
      </ActionField>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save Blog'}
      </button>
    </form>
  );
}
