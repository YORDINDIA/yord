'use client';

import { useRef, useState } from 'react';
import { Bold, List, Link2 } from 'lucide-react';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { updateProductAction } from '@/server/actions/products';
import { PRODUCT_STATUSES } from '@/lib/constants';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

/**
 * Product editor.
 *
 * The client-side title/handle checks remain as fast feedback, but the server
 * action re-validates the same rules through `productSchema`, so the form no
 * longer depends on this component running. `useActionForm` supplies the error
 * banner, per-field messages, the pending button, and the success toast.
 */
export default function ProductEditor({
  product,
}: {
  product: {
    id: number;
    title: string | null;
    handle: string | null;
    status: string | null;
    tags: string | null;
    body_html: string | null;
  };
}) {
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { state, pending, formAction, errorFor } = useActionForm(updateProductAction, {
    onResult: (result) => {
      if (result.status === 'success') setDirty(false);
    },
  });

  function wrap(tag: 'b' | 'ul' | 'a') {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd) || 'text';
    let insert = selected;
    if (tag === 'b') insert = `<strong>${selected}</strong>`;
    if (tag === 'ul') insert = `<ul><li>${selected}</li></ul>`;
    if (tag === 'a') insert = `<a href="https://">${selected}</a>`;
    el.setRangeText(insert, selectionStart, selectionEnd, 'end');
    el.focus();
    setDirty(true);
  }

  return (
    <>
      {dirty && (
        <div className="save-bar">
          <span className="helper">Unsaved changes</span>
          <button
            type="button"
            className="button primary"
            onClick={() => formRef.current?.requestSubmit()}
          >
            Save Product
          </button>
        </div>
      )}

      <form ref={formRef} action={formAction} className="form-grid" noValidate onChange={() => setDirty(true)}>
        <input type="hidden" name="id" value={product.id} />

        <FormError state={state} />

        <ActionField name="title" label="Title" state={state}>
          <input
            className="input"
            id="title"
            name="title"
            defaultValue={product.title || ''}
            aria-invalid={Boolean(errorFor('title'))}
            aria-describedby={errorFor('title') ? 'title-error' : undefined}
            required
          />
        </ActionField>

        <ActionField name="handle" label="Handle" state={state}>
          <input
            className="input"
            id="handle"
            name="handle"
            defaultValue={product.handle || ''}
            aria-invalid={Boolean(errorFor('handle'))}
            aria-describedby={errorFor('handle') ? 'handle-error' : undefined}
          />
        </ActionField>

        <div>
          <label className="helper" htmlFor="status">
            Status
          </label>
          <select className="select" id="status" name="status" defaultValue={product.status || 'draft'}>
            {PRODUCT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] ?? status}
              </option>
            ))}
          </select>
        </div>

        <ActionField name="tags" label="Tags" state={state}>
          <input
            className="input"
            id="tags"
            name="tags"
            defaultValue={product.tags || ''}
            aria-invalid={Boolean(errorFor('tags'))}
            aria-describedby={errorFor('tags') ? 'tags-error' : undefined}
          />
        </ActionField>

        <div style={{ gridColumn: '1 / -1' }}>
          <ActionField name="body_html" label="Description (HTML)" state={state}>
            <div className="toolbar" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="button icon-button"
                title="Bold"
                aria-label="Bold"
                onClick={() => wrap('b')}
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                className="button icon-button"
                title="Bullet list"
                aria-label="Bullet list"
                onClick={() => wrap('ul')}
              >
                <List size={15} />
              </button>
              <button
                type="button"
                className="button icon-button"
                title="Link"
                aria-label="Insert link"
                onClick={() => wrap('a')}
              >
                <Link2 size={15} />
              </button>
            </div>
            <textarea
              ref={bodyRef}
              className="textarea"
              id="body_html"
              name="body_html"
              rows={8}
              defaultValue={product.body_html || ''}
              aria-invalid={Boolean(errorFor('body_html'))}
              aria-describedby={errorFor('body_html') ? 'body_html-error' : undefined}
            />
          </ActionField>
        </div>

        <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Save Product'}
        </button>
      </form>
    </>
  );
}
