'use client';

import { useMemo, useState } from 'react';
import { Save, Tag, Type } from 'lucide-react';
import {
  ActionField,
  FormActions,
  FormError,
  FormSection,
  useActionForm,
} from '@/components/forms/ActionForm';
import { updateBlogAction } from '@/server/actions/blogs';
import { slugify } from '@/lib/utils/sanitize';
import type { Blog } from '@yord/db-types';

/**
 * Blog metadata editor, bound to the audited `updateBlogAction`.
 *
 * Fields are unchanged — `id`, `title`, `handle`, `tags` — and only their
 * layout moved into `FormSection`s. They are controlled so the handle preview
 * and the dirty flag follow typing; the action still regenerates an empty
 * handle from the title, which is what the preview shows.
 *
 * A blog has three writable columns in `blogSchema`, so there is no cover, SEO,
 * or status section to add here: `Blog` has no image, no description, and no
 * publish flag (its "status" on the list page is derived from its articles).
 */
export default function BlogEditor({ blog }: { blog: Blog }) {
  const { state, pending, formAction, errorFor } = useActionForm(updateBlogAction);

  const initial = useMemo(
    () => ({
      title: blog.title ?? '',
      handle: blog.handle ?? '',
      tags: blog.tags ?? '',
    }),
    [blog],
  );

  const [title, setTitle] = useState(initial.title);
  const [handle, setHandle] = useState(initial.handle);
  const [tags, setTags] = useState(initial.tags);

  // Adopt a new server version after a save (or a revalidation) unless the
  // admin typed while the write was in flight — same pattern as the article
  // editor, so the dirty flag cannot stick after a successful save.
  const [serverValues, setServerValues] = useState(initial);
  if (serverValues !== initial) {
    const edited =
      title !== serverValues.title || handle !== serverValues.handle || tags !== serverValues.tags;
    setServerValues(initial);
    if (!edited) {
      setTitle(initial.title);
      setHandle(initial.handle);
      setTags(initial.tags);
    }
  }

  const slug = useMemo(() => slugify(handle || title, `blog-${blog.id}`), [handle, title, blog.id]);
  const dirty =
    title !== initial.title || handle !== initial.handle || tags !== initial.tags;

  return (
    <form action={formAction} className="stack" noValidate>
      <input type="hidden" name="id" value={blog.id} />

      {dirty && (
        <div className="save-bar">
          <span className="helper-strong">Unsaved changes</span>
          <button className="button small primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : 'Save now'}
          </button>
        </div>
      )}

      <FormError state={state} />

      <FormSection title="Identity" icon={Type}>
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
            hint={`Stored as ${slug}`}
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
          Handle preview: <span className="mono">{slug}</span>
          {handle.trim() === '' && ' (regenerated from the title on every save while empty)'}
        </div>
      </FormSection>

      <FormSection
        title="Tags"
        icon={Tag}
        description="Comma separated. The storefront reads them as keywords, not as navigation."
      >
        <ActionField
          name="tags"
          label="Tags"
          state={state}
          hint={`${tags.length} / 500 characters`}
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
          <Save size={14} aria-hidden />
          {pending ? 'Saving…' : 'Save blog'}
        </button>
      </FormActions>
    </form>
  );
}
