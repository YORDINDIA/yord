'use client';

import { useRouter } from 'next/navigation';
import { BookPlus, Tag, Type } from 'lucide-react';
import {
  ActionField,
  FormActions,
  FormError,
  FormSection,
  useActionForm,
} from '@/components/forms/ActionForm';
import { createBlogAction } from '@/server/actions/blogs';

/**
 * New-blog form.
 *
 * The old inline action `throw`ed the raw PostgREST message on a failed insert,
 * which Next renders as a full-page error overlay rather than a form message,
 * and it wrote the row without an audit entry. `createBlogAction` reports the
 * failure in the form and records who created it.
 *
 * Field names are unchanged (`title`, `handle`, `tags`); on success the created
 * id opens the new blog's detail page.
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
    <form action={formAction} className="stack" noValidate>
      <FormError state={state} />

      <FormSection title="Identity" icon={Type}>
        <div className="grid-2">
          <ActionField name="title" label="Title" state={state}>
            <input
              className="input"
              id="title"
              name="title"
              aria-invalid={Boolean(errorFor('title'))}
              aria-describedby={errorFor('title') ? 'title-error' : undefined}
            />
          </ActionField>

          <ActionField
            name="handle"
            label="Handle"
            state={state}
            hint="Auto-generated from the title if left empty."
          >
            <input
              className="input mono"
              id="handle"
              name="handle"
              placeholder="auto-generated if empty"
              aria-invalid={Boolean(errorFor('handle'))}
              aria-describedby={errorFor('handle') ? 'handle-error' : undefined}
            />
          </ActionField>
        </div>
      </FormSection>

      <FormSection
        title="Tags"
        icon={Tag}
        description="Comma separated. Used as keywords; the storefront does not build navigation from them."
      >
        <ActionField name="tags" label="Tags" state={state} hint="Up to 500 characters.">
          <input
            className="input"
            id="tags"
            name="tags"
            aria-invalid={Boolean(errorFor('tags'))}
            aria-describedby={errorFor('tags') ? 'tags-error' : undefined}
          />
        </ActionField>
      </FormSection>

      <FormActions>
        <span className="helper">A blog starts empty — add its first draft from its page.</span>
        <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
          <BookPlus size={14} aria-hidden />
          {pending ? 'Creating…' : 'Create blog'}
        </button>
      </FormActions>
    </form>
  );
}
