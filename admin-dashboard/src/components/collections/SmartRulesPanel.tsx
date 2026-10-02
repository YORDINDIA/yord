'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { addSmartRuleAction } from '@/server/actions/collections';
import { SMART_RULE_COLUMNS, SMART_RULE_RELATIONS } from '@/lib/constants';
import type { SmartCollectionRule } from '@yord/db-types';

/**
 * Smart-collection rules.
 *
 * The old `saveRule` inserted the rule and ignored the returned error entirely,
 * so a rejected rule looked like it had been added. This submits to
 * `addSmartRuleAction`, which reports both validation and write failures.
 */
export default function SmartRulesPanel({
  collectionId,
  rules,
}: {
  collectionId: number;
  rules: SmartCollectionRule[];
}) {
  const { state, pending, formAction, errorFor } = useActionForm(addSmartRuleAction);

  return (
    <>
      <form action={formAction} className="form-grid" noValidate>
        <input type="hidden" name="collection_id" value={collectionId} />

        <FormError state={state} />

        <ActionField name="column_name" label="Field" state={state}>
          <select
            className="select"
            id="column_name"
            name="column_name"
            defaultValue="title"
            aria-invalid={Boolean(errorFor('column_name'))}
          >
            {SMART_RULE_COLUMNS.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </ActionField>

        <ActionField name="relation" label="Relation" state={state}>
          <select
            className="select"
            id="relation"
            name="relation"
            defaultValue="equals"
            aria-invalid={Boolean(errorFor('relation'))}
          >
            {SMART_RULE_RELATIONS.map((relation) => (
              <option key={relation} value={relation}>
                {relation}
              </option>
            ))}
          </select>
        </ActionField>

        <ActionField name="condition" label="Condition" state={state}>
          <input
            className="input"
            id="condition"
            name="condition"
            aria-invalid={Boolean(errorFor('condition'))}
          />
        </ActionField>

        <button className="button" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Adding…' : 'Add Rule'}
        </button>
      </form>

      {rules.length === 0 ? (
        <p className="helper">No rules yet. This collection will not auto-curate products.</p>
      ) : (
        <ul className="helper" style={{ marginTop: 12 }}>
          {rules.map((rule) => (
            <li key={rule.id}>
              {rule.column_name} {rule.relation} {rule.condition}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
