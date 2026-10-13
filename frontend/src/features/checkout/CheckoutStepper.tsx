'use client';

import { Check } from 'lucide-react';
import { cn } from '@yord/ui';

export interface CheckoutStep {
  id: number;
  name: string;
  description: string;
}

interface CheckoutStepperProps {
  steps: readonly CheckoutStep[];
  current: number;
  /** Called for a step the shopper has already completed — never forward. */
  onStepClick?: (id: number) => void;
}

/**
 * The three-step progress rail.
 *
 * It used to be a row of `<div>`s: no list semantics, no `aria-current`, and a
 * completed step rendered a bare `<Check>` with no text, so a screen reader
 * heard "1 2 3" and nothing else — while the completed/current distinction was
 * carried by colour alone. Now it is an `<ol>`, the current step carries
 * `aria-current="step"`, a completed step announces "Completed" and is a
 * button when the caller can jump back to it, and the connector is
 * `aria-hidden` decoration.
 */
export function CheckoutStepper({ steps, current, onStepClick }: CheckoutStepperProps) {
  return (
    <ol className="relative flex items-start justify-between">
      {steps.map((step, index) => {
        const isCompleted = current > step.id;
        const isCurrent = current === step.id;
        const canJump = isCompleted && Boolean(onStepClick);

        const circle = (
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
              isCompleted
                ? 'border-accent bg-accent text-text-on-accent'
                : isCurrent
                  ? 'border-accent bg-transparent text-accent'
                  : 'border-border-strong bg-transparent text-text-muted'
            )}
          >
            {isCompleted ? (
              <>
                <Check size={20} aria-hidden="true" />
                <span className="sr-only">Completed</span>
              </>
            ) : (
              <span className="font-accent text-lg">{step.id}</span>
            )}
          </span>
        );

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative z-10 flex flex-col items-center',
              index < steps.length - 1 && 'flex-1'
            )}
          >
            {canJump ? (
              <button
                type="button"
                onClick={() => onStepClick?.(step.id)}
                aria-label={`Go back to ${step.name}`}
                className="rounded-full"
              >
                {circle}
              </button>
            ) : (
              circle
            )}

            <div className="mt-2 text-center">
              <p
                className={cn(
                  'font-body text-sm font-medium',
                  isCurrent || isCompleted ? 'text-text-secondary' : 'text-text-muted'
                )}
              >
                {step.name}
              </p>
              <p className="hidden font-body text-xs text-text-muted sm:block">
                {step.description}
              </p>
            </div>

            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-5 left-[calc(50%+1.25rem)] h-0.5 w-[calc(100%-2.5rem)] -translate-y-1/2 overflow-hidden"
              >
                <span
                  className={cn(
                    'block h-full transition-colors',
                    isCompleted ? 'bg-accent' : 'bg-surface-inset'
                  )}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
