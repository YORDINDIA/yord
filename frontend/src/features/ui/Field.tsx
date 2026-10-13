'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@yord/ui';

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Throwing is the point: an input rendered outside a `Field` has no label
 * association, which is exactly the bug `Field` exists to remove. A silent
 * fallback would put an unlabelled control back on the page.
 */
function useFieldControl(component: string): FieldContextValue {
  const value = useContext(FieldContext);
  if (!value) {
    throw new Error(
      `<${component}> must be rendered inside a <Field>. The Field owns the label's htmlFor and the control's id; rendering the control alone loses that association.`
    );
  }
  return value;
}

const INPUT_CLASS =
  'w-full px-4 py-3 bg-surface-card border text-text-secondary placeholder:text-text-muted font-body text-sm transition-colors focus:border-accent';

export interface FieldProps {
  label: ReactNode;
  /** Used to build the control's id, so ids stay readable in devtools. */
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Label + control + error/hint, with the ids wired by `useId()`.
 *
 * The alternative — hand-written `id="email"` and `htmlFor="email"` — is what
 * the checkout address form shipped, and ten of its labels pointed at nothing.
 * Ids generated here cannot drift from the label, and cannot collide when two
 * forms (shipping and billing) render on the same page.
 */
export function Field({
  label,
  name,
  error,
  hint,
  required = false,
  children,
  className,
}: FieldProps) {
  const uid = useId();
  const id = `${name}-${uid}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The hint is only rendered when there is no error, so `aria-describedby`
  // must not name it in that case: pointing at an id that is not in the DOM is
  // a dangling reference the browser silently ignores.
  const showHint = Boolean(hint) && !error;
  const describedBy =
    [showHint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="font-body text-xs uppercase tracking-wider text-text-muted">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {' *'}
          </span>
        ) : null}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
        {children}
      </FieldContext.Provider>
      {error ? (
        // `role="alert"` so a validation failure is announced when it appears,
        // not only when the field is next focused.
        <p id={errorId} role="alert" className="font-body text-xs text-danger">
          {error}
        </p>
      ) : showHint ? (
        <p id={hintId} className="font-body text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** `id` is omitted: `Field` owns it, and passing one would silently lose the label. */
export type TextInputProps = Omit<React.ComponentPropsWithRef<'input'>, 'id'>;

export function TextInput({ className, ...props }: TextInputProps) {
  const { id, describedBy, invalid, required } = useFieldControl('TextInput');
  return (
    <input
      {...props}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      className={cn(INPUT_CLASS, invalid ? 'border-danger' : 'border-border-strong', className)}
    />
  );
}

/** `id` is omitted for the same reason as `TextInputProps`. */
export type TextAreaProps = Omit<React.ComponentPropsWithRef<'textarea'>, 'id'>;

export function TextArea({ className, ...props }: TextAreaProps) {
  const { id, describedBy, invalid, required } = useFieldControl('TextArea');
  return (
    <textarea
      {...props}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      className={cn(INPUT_CLASS, invalid ? 'border-danger' : 'border-border-strong', className)}
    />
  );
}

/** `id` is omitted for the same reason as `TextInputProps`. */
export type SelectInputProps = Omit<React.ComponentPropsWithRef<'select'>, 'id'>;

export function SelectInput({ className, children, ...props }: SelectInputProps) {
  const { id, describedBy, invalid, required } = useFieldControl('SelectInput');
  return (
    <select
      {...props}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      className={cn(INPUT_CLASS, invalid ? 'border-danger' : 'border-border-strong', className)}
    >
      {children}
    </select>
  );
}
