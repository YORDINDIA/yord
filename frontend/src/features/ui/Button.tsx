import { cn } from '@yord/ui';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

/**
 * Server-safe: nothing here needs the client. React 19 passes `ref` as a
 * normal prop, so there is no `forwardRef` wrapper and no `'use client'` —
 * a server component can render a styled button without pulling a client
 * boundary in behind it.
 */
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  fullWidth,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses(variant, size, fullWidth, className)}
      disabled={disabled || isLoading}
      // `aria-busy` is what tells a screen reader the button is working;
      // the spinner alone is invisible to it.
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          aria-hidden="true"
          focusable="false"
          className="absolute left-1/2 -translate-x-1/2 w-5 h-5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {/* Held at opacity 0 rather than removed so the button keeps its width
          while loading and the layout does not jump. */}
      <span className={cn(isLoading && 'opacity-0')}>{children}</span>
    </button>
  );
}
