'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import AuditDiff from './AuditDiff';
import { shortId } from './format';
import styles from './settings.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * The audit row's one action: open the recorded before/after payloads.
 *
 * The dialog is focus-trapped the way `ConfirmModal` is (Escape closes, Tab
 * cycles inside, the backdrop closes on click) and mounted only while it is
 * open, so a page of 20 rows carries 20 small buttons and no dialog tree.
 *
 * Every string in the header arrives pre-computed from the server page: the
 * relative time would otherwise be evaluated twice (streaming and hydration) and
 * the two values can differ by the second, which React reports as a text
 * mismatch.
 */
export default function AuditDetailButton({
  action,
  entity,
  entityId,
  actor,
  whenLabel,
  whenTitle,
  before,
  after,
}: {
  action: string;
  entity: string;
  entityId: string;
  /** Name, email, or a truncated uuid — whatever the identity lookup resolved. */
  actor: string;
  whenLabel: string;
  whenTitle: string;
  before: unknown;
  after: unknown;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="button small"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Details for ${action} on ${entity} ${entityId}`}
      >
        <Eye size={14} aria-hidden />
        Details
      </button>
      {open && (
        <AuditDetailDialog
          action={action}
          entity={entity}
          entityId={entityId}
          actor={actor}
          whenLabel={whenLabel}
          whenTitle={whenTitle}
          before={before}
          after={after}
          onClose={close}
        />
      )}
    </>
  );
}

function AuditDetailDialog({
  action,
  entity,
  entityId,
  actor,
  whenLabel,
  whenTitle,
  before,
  after,
  onClose,
}: {
  action: string;
  entity: string;
  entityId: string;
  actor: string;
  whenLabel: string;
  whenTitle: string;
  before: unknown;
  after: unknown;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Escape closes; Tab cycles within the dialog. Listening on `document` keeps
  // the trap working when focus sits on the dialog container itself.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The only control in the dialog gets focus, so Escape and Tab both start
  // inside the trap.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={clsx('card', 'modal-card', styles.auditModal)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          {action}
        </h2>
        <div className={styles.modalMeta}>
          <span>
            <span className="helper">Entity </span>
            <strong className="mono">{entity}</strong>
          </span>
          <span>
            <span className="helper">ID </span>
            <strong className="mono" title={entityId}>
              {shortId(entityId, 12)}
            </strong>
          </span>
          <span>
            <span className="helper">Actor </span>
            <strong>{actor}</strong>
          </span>
          <span title={whenTitle}>{whenLabel}</span>
        </div>

        <AuditDiff before={before} after={after} />

        <div className="modal-actions">
          <button ref={closeRef} type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
