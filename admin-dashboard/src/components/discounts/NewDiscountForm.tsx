'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, Percent, Sparkles, Tag } from 'lucide-react';
import {
  ActionField,
  FormActions,
  FormError,
  FormSection,
  useActionForm,
} from '@/components/forms/ActionForm';
import type { ActionState } from '@/lib/action-state';
import { DISCOUNT_VALUE_TYPES } from '@/lib/constants';
import { discountSchema } from '@/lib/validation';
import { createDiscountAction } from '@/server/actions/discounts';
import DiscountPreview from './DiscountPreview';
import { suggestCode } from './format';

/** Hint under the value field, per value type. */
const VALUE_HINTS: Record<string, string> = {
  percentage: 'Between 0.01 and 100, e.g. 10 for 10% off.',
  fixed_amount: 'Rupees off the order total, e.g. 500 for ₹500 off.',
};

/**
 * New-discount form: Basics / Value / Schedule sections, a coupon preview that
 * mirrors what is typed, and one submit path.
 *
 * The old form `throw`ed the raw PostgREST message on either insert failure, so
 * a rejected code left a `price_rules` row behind and rendered a full-page error
 * overlay instead of a field message. `createDiscountAction` rolls the rule back,
 * explains the duplicate-code case, and reports in the form.
 *
 * The action stays the validation boundary; `discountSchema` is re-run here first
 * only so a mistake is shown instantly instead of after a round trip. Field names
 * and the `datetime-local` string format are byte-for-byte what the action reads
 * — `ends_at > starts_at` is compared as raw strings client-side *and* server-side,
 * which is exactly why the inputs cannot be converted to ISO here.
 */
export default function NewDiscountForm() {
  const router = useRouter();
  const { state, pending, formAction } = useActionForm<{ id: number }>(createDiscountAction, {
    onResult: (result) => {
      // Unchanged behaviour: a created discount returns to the list (the action's
      // success message has already been toasted).
      if (result.status === 'success' && result.data?.id) router.push('/discounts');
    },
  });

  // Field values are controlled because the preview card mirrors them live and
  // the code suggestion derives from the title.
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [codeEdited, setCodeEdited] = useState(false);
  const [value, setValue] = useState('');
  const [valueType, setValueType] = useState<string>(DISCOUNT_VALUE_TYPES[0]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({});
  const [submitting, startSubmit] = useTransition();

  const suggested = suggestCode(title);
  // The suggestion follows the title until the admin edits the code themselves;
  // after that their value owns the field. Re-deriving it on every later
  // keystroke of the *title* would overwrite what they typed.
  const shownCode = codeEdited ? code : suggested;

  // Client and server field errors merged per field, with the client's winning:
  // both come from the same schema, and a client error describes the field as it
  // is now while a server error describes the previous submission.
  const fieldState: ActionState<{ id: number }> = useMemo(() => {
    const fromServer = state.status === 'error' ? state.fieldErrors ?? {} : {};
    const merged = { ...fromServer, ...clientErrors };
    if (Object.keys(merged).length === 0) return state;
    return { ...state, status: 'error', fieldErrors: merged };
  }, [state, clientErrors]);

  function fieldError(field: string): string | undefined {
    return fieldState.status === 'error' ? fieldState.fieldErrors?.[field]?.[0] : undefined;
  }

  /** `aria-invalid` plus the wire to the message `ActionField` renders below. */
  function aria(field: string) {
    return {
      'aria-invalid': Boolean(fieldError(field)),
      'aria-describedby': fieldError(field) ? `${field}-error` : undefined,
    };
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    // Fast feedback on the shared schema. The action re-parses the same schema as
    // its own boundary, so this only turns a round trip into an instant message.
    const parsed = discountSchema.safeParse(Object.fromEntries(data.entries()));
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >;
      const next: Record<string, string[]> = {};
      for (const [field, messages] of Object.entries(flattened)) {
        if (messages?.length) next[field] = messages;
      }
      setClientErrors(next);
      return;
    }

    setClientErrors({});
    // Dispatched inside a transition rather than through `<form action>`: the
    // submit has to be intercepted to validate first. The action state updates
    // identically, and this transition's own pending flag covers the gap.
    startSubmit(() => formAction(data));
  }

  const busy = pending || submitting;

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="layout-split">
        <div className="stack">
          <FormError state={state} />

          <FormSection title="Basics" icon={Tag}>
            <ActionField
              name="title"
              label="Title"
              state={fieldState}
              hint="Admin-facing name. Shoppers only ever see the code."
            >
              <input
                className="input"
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoComplete="off"
                {...aria('title')}
              />
            </ActionField>

            <ActionField
              name="code"
              label="Code"
              state={fieldState}
              hint={
                codeEdited
                  ? 'Letters, numbers, dashes, and underscores. Stored in capitals.'
                  : 'Filled in from the title. Type over it to use your own code.'
              }
            >
              <input
                className="input mono"
                id="code"
                name="code"
                value={shownCode}
                onChange={(event) => {
                  setCodeEdited(true);
                  setCode(event.target.value.toUpperCase());
                }}
                autoComplete="off"
                spellCheck={false}
                {...aria('code')}
              />
            </ActionField>

            {suggested && shownCode !== suggested && (
              <div className="row">
                <button
                  className="button small"
                  type="button"
                  title={suggested}
                  onClick={() => {
                    setCodeEdited(false);
                    setCode('');
                  }}
                >
                  <Sparkles size={12} aria-hidden />
                  Use suggested code
                </button>
              </div>
            )}
          </FormSection>

          <FormSection title="Value" icon={Percent}>
            <div className="grid-2">
              <ActionField name="value_type" label="Type" state={fieldState}>
                <select
                  className="select"
                  id="value_type"
                  name="value_type"
                  value={valueType}
                  onChange={(event) => setValueType(event.target.value)}
                  {...aria('value_type')}
                >
                  {DISCOUNT_VALUE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === 'percentage' ? 'Percentage' : 'Fixed amount'}
                    </option>
                  ))}
                </select>
              </ActionField>

              <ActionField
                name="value"
                label={valueType === 'percentage' ? 'Percentage off' : 'Amount off (₹)'}
                state={fieldState}
                hint={VALUE_HINTS[valueType]}
              >
                <input
                  className="input num"
                  id="value"
                  name="value"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  // Advisory only (`noValidate` skips native checks): the shared
                  // schema is the boundary, so this cannot reject a value the
                  // server would accept.
                  max={valueType === 'percentage' ? 100 : undefined}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  autoComplete="off"
                  {...aria('value')}
                />
              </ActionField>
            </div>
          </FormSection>

          <FormSection title="Schedule" icon={CalendarClock}>
            <div className="grid-2">
              <ActionField
                name="starts_at"
                label="Starts at"
                state={fieldState}
                hint="Leave empty to start as soon as it is created."
              >
                <input
                  className="input"
                  id="starts_at"
                  name="starts_at"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  {...aria('starts_at')}
                />
              </ActionField>

              <ActionField
                name="ends_at"
                label="Ends at"
                state={fieldState}
                hint="Must be after the start. Leave empty for an open-ended code."
              >
                <input
                  className="input"
                  id="ends_at"
                  name="ends_at"
                  type="datetime-local"
                  min={startsAt || undefined}
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  {...aria('ends_at')}
                />
              </ActionField>
            </div>
          </FormSection>
        </div>

        <aside className="side-rail">
          <DiscountPreview
            title={title}
            code={shownCode}
            value={value}
            valueType={valueType}
            startsAt={startsAt}
            endsAt={endsAt}
          />
        </aside>
      </div>

      <FormActions>
        <Link className="button" href="/discounts">
          Cancel
        </Link>
        <button className="button primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Creating…' : 'Create discount'}
        </button>
      </FormActions>
    </form>
  );
}
