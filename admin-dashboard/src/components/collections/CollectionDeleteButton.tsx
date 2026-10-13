'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useActionForm } from '@/components/forms/ActionForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { deleteCollectionAction } from '@/server/actions/collections';

/**
 * Delete control for the collection detail rail.
 *
 * The `<form>` is real — the hidden `collection_id` and the action's own
 * parsing stay the single write path — but its submit is held back until the
 * ConfirmModal is accepted: the visible button only opens the dialog, and the
 * dialog's confirm calls `requestSubmit()` on the form. On success the toast
 * fires from `useActionForm` and the page navigates back to the list, since
 * this route's row no longer exists.
 */
export default function CollectionDeleteButton({
  collectionId,
  title,
  handle,
}: {
  collectionId: number;
  title: string;
  handle: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const del = useActionForm(deleteCollectionAction, {
    onResult: (state) => {
      if (state.status === 'success') {
        setConfirmOpen(false);
        router.push('/collections');
      }
    },
  });

  return (
    <>
      <form ref={formRef} action={del.formAction}>
        <input type="hidden" name="collection_id" value={collectionId} />
      </form>

      <button className="button danger" type="button" onClick={() => setConfirmOpen(true)}>
        <Trash2 size={14} aria-hidden />
        Delete collection
      </button>

      <ConfirmModal
        open={confirmOpen}
        tone="danger"
        title={`Delete “${title}”?`}
        body={
          <>
            Removes this collection together with its product memberships and smart rules. The
            storefront page <span className="mono">/collection/{handle ?? '…'}</span> will 404. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete collection"
        cancelLabel="Keep collection"
        pending={del.pending}
        onConfirm={() => formRef.current?.requestSubmit()}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
