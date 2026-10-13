'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field, TextInput } from '@/features/ui/Field';
import { IconButton } from '@/features/ui/IconButton';

export interface PasswordFieldProps {
  label: string;
  /** Builds the control's id, so ids stay readable in devtools. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Passed to `autoComplete`: `new-password` on sign-up/reset, `current-password` on sign-in. */
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

/**
 * Password input + visibility toggle, wired through `Field`.
 *
 * The toggle was a bare `<button>` with no `type` inside three different forms;
 * here it is the shared `IconButton`, so it gets `type="button"` (never submits),
 * the 32px hit area and the same focus treatment as every other icon control.
 * `aria-pressed` reports the current state of the toggle, not just its action.
 */
export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  placeholder,
  required,
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field
      label={label}
      name={name}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        <TextInput
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          // Room for the toggle, which sits inside the input's right edge.
          className="pr-12"
        />
        <IconButton
          label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </IconButton>
      </div>
    </Field>
  );
}
