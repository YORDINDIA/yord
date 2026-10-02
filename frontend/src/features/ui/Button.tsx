'use client';

import { forwardRef } from 'react';
import { cn } from '@yord/ui';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, fullWidth, children, disabled, ...props }, ref) => {
    const baseStyles = `
      relative inline-flex items-center justify-center
      font-[family-name:var(--font-bebas)] tracking-[0.15em] uppercase
      transition-all duration-300 ease-out
      disabled:opacity-50 disabled:cursor-not-allowed
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page
    `;

    const variants = {
      primary: `
        bg-accent text-text-on-accent
        hover:bg-accent-hover hover:shadow-[var(--shadow-gold)]
        active:scale-[0.98]
      `,
      secondary: `
        bg-transparent text-text-primary border border-text-primary
        hover:bg-text-primary hover:text-text-on-accent
        active:scale-[0.98]
      `,
      ghost: `
        bg-transparent text-text-secondary
        hover:bg-surface-raised hover:text-text-primary
        active:scale-[0.98]
      `,
      gold: `
        bg-gradient-to-r from-accent to-accent-hover text-text-on-accent
        hover:shadow-[var(--shadow-gold)]
        active:scale-[0.98]
      `,
    };

    const sizes = {
      sm: 'px-4 py-2 text-xs',
      md: 'px-6 py-3 text-sm',
      lg: 'px-8 py-4 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
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
        <span className={cn(isLoading && 'opacity-0')}>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
