'use client';

import { useRouter } from 'next/navigation';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { createBlogAction } from '@/server/actions/blogs';

/**
 * New-blog form.
 *
 * The old inline action `throw`ed the raw PostgREST message on a failed insert,
 * which Next renders as a full-page error overlay rather than a form message,
 * and it wrote the row without an audit entry. `createBlogAction` reports the
 * failure in the form and records who created it.
 */
export default function NewBlogForm() {
  const router = useRouter();
  const { state, pending, formAction, errorFor } = useActionForm<{ id: number }>(
    createBlogAction,
    {
      onResult: (result) => {
        if (result.status === 'success' && result.data?.id) {
          router.push(`/blogs/${result.data.id}`);
        }
      },
    },
  );

  return (
    <form action={formAction} className="form-grid" noValidate>
      <FormError state={state} />

      <ActionField name="title" label="Title" state={state}>
        <input
          className="input"
          id="title"
          name="title"
          aria-invalid={Boolean(errorFor('title'))}
          aria-describedby={errorFor('title') ? 'title-error' : undefined}
        />
      </ActionField>

      <ActionField name="handle" label="Handle" state={state}>
        <input
          className="input"
          id="handle"
          name="handle"
          placeholder="auto-generated if empty"
          aria-invalid={Boolean(errorFor('handle'))}
        />
      </ActionField>

      <ActionField name="tags" label="Tags" state={state}>
        <input className="input" id="tags" name="tags" aria-invalid={Boolean(errorFor('tags'))} />
      </ActionField>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Creating…' : 'Create Blog'}
      </button>
    </form>
  );
}
