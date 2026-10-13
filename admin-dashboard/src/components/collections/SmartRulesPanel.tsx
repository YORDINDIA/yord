'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Play, Search, Trash2 } from 'lucide-react';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  addSmartRuleAction,
  applySmartRulesAction,
  deleteSmartRuleAction,
  previewSmartRulesAction,
  type SmartRulesPreview,
} from '@/server/actions/collections';
import { SMART_RULE_COLUMNS, SMART_RULE_RELATIONS } from '@/lib/constants';
import { partitionRules } from '@/lib/collection-rules';
import StatusBadge from '@/components/ui/StatusBadge';
import type { SmartCollectionRule } from '@yord/db-types';

/**
 * Smart-collection rules.
 *
 * Two bugs this replaces:
 *  1. the old form inserted the rule and ignored the returned error entirely,
 *     so a rejected rule looked like it had been added;
 *  2. nothing ever read `smart_collection_rules` — not the storefront, not any
 *     action — so "smart" collections were permanently empty.
 *
 * "Preview matches" counts what the rules select right now (a read), and
 * "Apply now" copies those products into the collection's `collects` rows,
 * which is what the storefront actually renders. Stored rules this builder
 * cannot evaluate (the Shopify import wrote its own column/relation names into
 * the table) are labelled rather than quietly ignored.
 */
export default function SmartRulesPanel({
  collectionId,
  rules,
  collectionType,
}: {
  collectionId: number;
  rules: SmartCollectionRule[];
  collectionType: string;
}) {
  const add = useActionForm(addSmartRuleAction);
  const [pendingDelete, setPendingDelete] = useState<SmartCollectionRule | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const applyIntentRef = useRef(false);
  const previewFormRef = useRef<HTMLFormElement>(null);
  const applyFormRef = useRef<HTMLFormElement>(null);
  const preview = useActionForm<SmartRulesPreview>(previewSmartRulesAction, {
    onResult: (state) => {
      // Only an "Apply now" click opens the dialog; a plain "Preview matches"
      // run still shows its sample inline as before.
      if (!applyIntentRef.current) return;
      applyIntentRef.current = false;
      if (state.status === 'success') setConfirmOpen(true);
    },
  });
  const apply = useActionForm<{ count: number }>(applySmartRulesAction, {
    onResult: (state) => {
      if (state.status === 'success') setConfirmOpen(false);
    },
  });
  const remove = useActionForm(deleteSmartRuleAction);

  /** Step 1 of "Apply now": refresh the preview, so the dialog shows the current diff. */
  function beginApply() {
    applyIntentRef.current = true;
    previewFormRef.current?.requestSubmit();
  }

  /** Step 2: the dialog's confirm submits the real apply form. */
  function confirmApply() {
    applyFormRef.current?.requestSubmit();
  }

  const previewData = preview.state.status === 'success' ? preview.state.data : null;

  const isSmart = collectionType === 'smart';
  const busy = preview.pending || apply.pending || remove.pending;

  /** Rules the products query cannot run, so the admin is not misled by the match count. */
  const unsupportedIds = useMemo(
    () => new Set(partitionRules(rules).unsupported.map((entry) => entry.rule.id)),
    [rules],
  );

  /** Shared hidden field for the preview / apply forms. */
  const collectionField = <input type="hidden" name="collection_id" value={collectionId} />;

  if (!isSmart) {
    return (
      <p className="helper">
        This is a custom collection, so its products are the hand-picked list above. Switch the type to
        <strong> Smart</strong> to curate it with rules.
      </p>
    );
  }

  return (
    <>
      <form action={add.formAction} className="form-grid" noValidate>
        {collectionField}
        <FormError state={add.state} />

        <ActionField name="column_name" label="Field" state={add.state}>
          <select
            className="select"
            id="column_name"
            name="column_name"
            defaultValue="title"
            aria-invalid={Boolean(add.errorFor('column_name'))}
          >
            {SMART_RULE_COLUMNS.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </ActionField>

        <ActionField name="relation" label="Relation" state={add.state}>
          <select
            className="select"
            id="relation"
            name="relation"
            defaultValue="contains"
            aria-invalid={Boolean(add.errorFor('relation'))}
          >
            {SMART_RULE_RELATIONS.map((relation) => (
              <option key={relation} value={relation}>
                {relation.replace('_', ' ')}
              </option>
            ))}
          </select>
        </ActionField>

        <ActionField name="condition" label="Condition" state={add.state}>
          <input
            className="input"
            id="condition"
            name="condition"
            placeholder="e.g. coldplay"
            aria-invalid={Boolean(add.errorFor('condition'))}
          />
        </ActionField>

        <div>
          <button className="button" type="submit" disabled={add.pending || busy} aria-busy={add.pending}>
            {add.pending ? 'Adding…' : 'Add Rule'}
          </button>
        </div>
      </form>

      {rules.length === 0 ? (
        <p className="helper" style={{ marginTop: 12 }}>
          No rules yet. This collection will not auto-curate products.
        </p>
      ) : (
        <>
          {unsupportedIds.size > 0 && (
            <div className="form-alert form-alert-error tone-rose" role="status" style={{ marginTop: 12 }}>
              <AlertTriangle size={15} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
              <span>
                {unsupportedIds.size} of these {rules.length} rule
                {rules.length === 1 ? '' : 's'} use a field or relation this builder cannot run, so{' '}
                {unsupportedIds.size === 1 ? 'it is' : 'they are'} labelled below and excluded from
                preview and apply. Delete and recreate them with the fields in the dropdown above.
              </span>
            </div>
          )}
          <ul className="list-rows" style={{ marginTop: 12 }}>
            {rules.map((rule) => (
              <li key={rule.id} className="list-row">
                <span className="chip mono">{rule.column_name}</span>
                <span className="helper">{rule.relation.replace('_', ' ')}</span>
                <span className="list-row-body list-row-title">{rule.condition}</span>
                {unsupportedIds.has(rule.id) && (
                  <StatusBadge value="ignored" tone="warning" label="Not evaluated" />
                )}
                <button
                  type="button"
                  className="button icon-button small"
                  aria-label={`Delete rule ${rule.column_name} ${rule.relation} ${rule.condition}`}
                  disabled={remove.pending}
                  onClick={() => setPendingDelete(rule)}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>

          <p className="helper" style={{ marginTop: 8 }}>
            Rules are saved as you add them; the AND/OR setting above is applied when you save the
            collection form, which is what “Preview matches” and “Apply now” read.
          </p>

          <div className="toolbar" style={{ marginTop: 12 }}>
            <form ref={previewFormRef} action={preview.formAction}>
              {collectionField}
              <button className="button" type="submit" disabled={busy} aria-busy={preview.pending}>
                <Search size={13} aria-hidden="true" />
                {preview.pending ? 'Checking…' : 'Preview matches'}
              </button>
            </form>
            {/* Two-step on purpose: this click only refreshes the preview; the
                confirm dialog below submits the real apply form, so the admin
                sees the adds/removes diff before membership is replaced. */}
            <button
              className="button primary"
              type="button"
              disabled={busy}
              aria-busy={preview.pending}
              onClick={beginApply}
            >
              <Play size={13} aria-hidden="true" />
              Apply now
            </button>
            <form ref={applyFormRef} action={apply.formAction}>
              {collectionField}
              {/* requestSubmit target for the confirm dialog only. */}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1}>
                Apply
              </button>
            </form>
          </div>

          <FormError state={preview.state} />
          <FormError state={apply.state} />

          {/* The toast carries the count; the sample shows *which* products the
              rules select, which is what makes a rule safe to apply. */}
          {preview.state.status === 'success' && preview.state.data && (
            <div className="card-inset" style={{ marginTop: 12 }}>
              <div className="helper">
                {preview.state.data.count} product{preview.state.data.count === 1 ? '' : 's'} match
                {preview.state.data.count > preview.state.data.sample.length
                  ? ` · first ${preview.state.data.sample.length}:`
                  : ':'}
              </div>
              <ul className="list-rows" style={{ marginTop: 6 }}>
                {preview.state.data.sample.map((row) => (
                  <li key={row.id} className="list-row">
                    <span className="list-row-body list-row-title">{row.title}</span>
                    <span className="list-row-meta">#{row.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Step 2 of "Apply now": the fresh preview's diff, shown before the
          membership is replaced. `previewData` is the preview this dialog
          confirmed — `beginApply` always re-runs it first. */}
      {previewData && (
        <ConfirmModal
          open={confirmOpen}
          title="Apply rules — replaces membership"
          body="Applying copies what the rules match right now into this collection, replacing its whole product list."
          confirmLabel="Apply rules"
          pending={apply.pending}
          onConfirm={confirmApply}
          onClose={() => setConfirmOpen(false)}
        >
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {previewData.count === 0 && (
              <p className="helper" style={{ margin: 0 }}>
                No products match these rules, so applying now would remove every current member. An
                empty match is refused, so nothing would change.
              </p>
            )}
            <div>
              <div className="helper">+{previewData.adds} to add</div>
              {previewData.sampleAdds.length > 0 && (
                <ul className="list-rows" style={{ marginTop: 4 }}>
                  {previewData.sampleAdds.map((row) => (
                    <li key={row.id} className="list-row">
                      <span className="list-row-body list-row-title">{row.title}</span>
                      <span className="list-row-meta">#{row.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="helper">−{previewData.removes} to remove</div>
              {previewData.sampleRemoves.length > 0 && (
                <ul className="list-rows" style={{ marginTop: 4 }}>
                  {previewData.sampleRemoves.map((row) => (
                    <li key={row.id} className="list-row">
                      <span className="list-row-body list-row-title">{row.title}</span>
                      <span className="list-row-meta">#{row.id}</span>
                    </li>
                  ))}
                  {previewData.removes > previewData.sampleRemoves.length && (
                    <li className="list-row">
                      <span className="list-row-meta">
                        + {previewData.removes - previewData.sampleRemoves.length} more
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="helper">
              {previewData.unchanged} already{' '}
              {previewData.unchanged === 1 ? 'member' : 'members'} — unchanged by applying.
            </div>
            {previewData.unsupported > 0 && (
              <div className="helper">
                {previewData.unsupported} rule{previewData.unsupported === 1 ? '' : 's'} cannot be
                evaluated and {previewData.unsupported === 1 ? 'is' : 'are'} excluded from this match.
              </div>
            )}
            {previewData.removes > 0 && (
              <div
                className="form-alert form-alert-error tone-rose"
                role="status"
                style={{ marginBottom: 0 }}
              >
                <AlertTriangle size={15} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
                <span>
                  Applying replaces the whole membership: the {previewData.removes} product
                  {previewData.removes === 1 ? '' : 's'} counted above will be removed from the
                  collection. To keep any of them, add them back by hand afterwards.
                </span>
              </div>
            )}
          </div>
        </ConfirmModal>
      )}

      {pendingDelete && (
        <div className="card-inset" style={{ marginTop: 12 }}>
          <div className="helper">
            Delete the rule <code>{pendingDelete.condition}</code>? Products already applied stay in the
            collection until the next “Apply now”.
          </div>
          <form
            action={remove.formAction}
            className="toolbar"
            style={{ marginTop: 8 }}
            onSubmit={() => setPendingDelete(null)}
          >
            {collectionField}
            <input type="hidden" name="rule_id" value={pendingDelete.id} />
            <button className="button danger" type="submit" disabled={remove.pending} aria-busy={remove.pending}>
              {remove.pending ? 'Deleting…' : 'Delete rule'}
            </button>
            <button className="button" type="button" onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}
    </>
  );
}
