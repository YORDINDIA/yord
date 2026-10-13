'use client';

import { cn } from '@yord/ui';
import { accentInk } from '@/features/catalog/accentInk';

/** One selectable variant, already normalized from the two row shapes. */
export interface VariantChoice {
  id: number;
  label: string;
  available: boolean;
}

interface VariantPickerProps {
  /** The option's name ("Size"); becomes the fieldset legend. */
  label: string;
  choices: VariantChoice[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Artist brand colour or `var(--accent)`; decides which ink sits on it. */
  accentColor?: string;
  /** Radio group name — unique per rendered picker on the page. */
  name: string;
}

/**
 * The size selector, shared by the PDP and QuickView so the same product cannot
 * show two different control styles.
 *
 * A real `<fieldset>` + radio group rather than styled buttons: the previous
 * button list read as "M", "L", "XL" with no group name and no selected state,
 * so a screen reader could not say what the choice was about or which option
 * was current. Radios carry both for free, and arrow keys move between sizes.
 */
export function VariantPicker({
  label,
  choices,
  selectedId,
  onSelect,
  accentColor,
  name,
}: VariantPickerProps) {
  return (
    <fieldset>
      {/* `w-full`: a legend shrink-wraps by default, which would leave the
          trailing rule short of the column. */}
      <legend className="mb-3 w-full font-accent text-sm tracking-[0.15em] text-text-muted">
        {label.toUpperCase()}
      </legend>
      <div className="flex flex-wrap gap-3">
        {choices.map((choice) => {
          const isSelected = choice.id === selectedId;
          return (
            <label
              key={choice.id}
              className={cn(
                'relative min-w-[48px] h-12 px-4 flex items-center justify-center border-2',
                'font-accent text-sm tracking-wider cursor-pointer transition-colors',
                // The radio itself is `sr-only`, so the focus ring has to be
                // drawn by the label the shopper actually sees.
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring',
                isSelected
                  ? cn('border-transparent', accentInk(accentColor))
                  : choice.available
                    ? 'border-border-default text-text-secondary hover:border-text-muted'
                    : 'border-border-default text-text-muted cursor-not-allowed line-through'
              )}
              style={isSelected ? { backgroundColor: accentColor ?? 'var(--accent)' } : undefined}
            >
              <input
                type="radio"
                name={name}
                value={choice.id}
                checked={isSelected}
                disabled={!choice.available}
                onChange={() => onSelect(choice.id)}
                className="sr-only"
              />
              {choice.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
