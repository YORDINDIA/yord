'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@yord/ui';
import { IconButton } from '@/features/ui/IconButton';

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
  className?: string;
}

/**
 * Quantity −/+ control, shared by the PDP and QuickView.
 *
 * The readout is `aria-live` because the two icon buttons announce nothing on
 * their own: a screen-reader user pressing + hears "Increase quantity" but has
 * no way to hear the value it produced.
 */
export function QuantityStepper({ value, max, onChange, className }: QuantityStepperProps) {
  const atMax = value >= max;

  return (
    <div className={cn('flex items-center border border-border-default w-fit', className)}>
      <IconButton
        label="Decrease quantity"
        variant="ghost"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="rounded-none"
      >
        <Minus size={16} />
      </IconButton>
      <span aria-live="polite" className="w-10 text-center font-body text-text-primary">
        {value}
      </span>
      <IconButton
        label="Increase quantity"
        variant="ghost"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={atMax}
        className="rounded-none"
      >
        <Plus size={16} />
      </IconButton>
    </div>
  );
}
