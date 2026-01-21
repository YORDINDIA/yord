'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

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
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-200 focus-visible:ring-offset-2 focus-visible:ring-offset-noir-950
    `;

    const variants = {
      primary: `
        bg-gold-200 text-noir-950
        hover:bg-gold-300 hover:shadow-[0_4px_30px_rgba(255,217,102,0.15)]
        active:scale-[0.98]
      `,
      secondary: `
        bg-transparent text-ivory-50 border border-ivory-50
        hover:bg-ivory-50 hover:text-noir-950
        active:scale-[0.98]
      `,
      ghost: `
        bg-transparent text-ivory-100
        hover:bg-noir-800 hover:text-ivory-50
        active:scale-[0.98]
      `,
      gold: `
        bg-gradient-to-r from-gold-200 to-gold-400 text-noir-950
        hover:shadow-[0_0_30px_rgba(255,217,102,0.5),0_0_60px_rgba(255,217,102,0.2)]
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
