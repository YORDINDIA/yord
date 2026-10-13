'use client';

import { CreditCard, Landmark, Lock, Wallet } from 'lucide-react';
import { cn } from '@yord/ui';
import type { PaymentMethod } from './types';

export type { PaymentMethod } from './types';

interface PaymentSectionProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
}

const PAYMENT_METHODS = [
  {
    id: 'razorpay' as PaymentMethod,
    name: 'Credit / Debit Card',
    description: 'Pay securely with Visa, Mastercard, RuPay',
    icon: CreditCard,
  },
  {
    id: 'upi' as PaymentMethod,
    name: 'UPI',
    description: 'Pay using Google Pay, PhonePe, Paytm, or any UPI app',
    icon: Wallet,
  },
  {
    id: 'netbanking' as PaymentMethod,
    name: 'Net Banking',
    description: 'Pay directly from your bank account',
    icon: Landmark,
  },
];

/**
 * Payment method picker.
 *
 * Each option was a `<button>` — three tab stops for one choice, no group
 * semantics, and nothing announcing which option was selected. They are real
 * radios inside a `<fieldset>` now: one tab stop, arrow-key navigation and
 * `aria-checked` come from the platform, and the card stays fully clickable
 * because the whole thing is the label.
 */
export function PaymentSection({ selectedMethod, onMethodChange }: PaymentSectionProps) {
  return (
    <fieldset className="space-y-6">
      <legend className="font-display text-xl text-text-primary mb-6">
        Payment Method
      </legend>

      <div className="space-y-3">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.id;

          return (
            <label
              key={method.id}
              className={cn(
                'flex w-full cursor-pointer items-start gap-4 border p-4 text-left transition-all',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring',
                isSelected
                  ? 'border-accent bg-accent-tint'
                  : 'border-border-default bg-surface-card hover:border-text-muted'
              )}
            >
              <input
                type="radio"
                name="payment-method"
                value={method.id}
                checked={isSelected}
                onChange={() => onMethodChange(method.id)}
                className="sr-only"
              />

              {/* Radio Circle */}
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2',
                  isSelected ? 'border-accent' : 'border-text-muted'
                )}
              >
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </span>

              {/* Icon */}
              <Icon
                aria-hidden="true"
                className={cn('h-6 w-6 flex-shrink-0', isSelected ? 'text-accent' : 'text-text-muted')}
              />

              {/* Content */}
              <span className="flex-1">
                <span
                  className={cn(
                    'block font-body font-medium',
                    isSelected ? 'text-accent' : 'text-text-secondary'
                  )}
                >
                  {method.name}
                </span>
                <span className="mt-0.5 block font-body text-sm text-text-muted">
                  {method.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Secure Payment Notice */}
      <p className="flex items-center gap-2 font-body text-xs text-text-muted">
        <Lock size={16} aria-hidden="true" />
        Your payment information is encrypted and secure
      </p>
    </fieldset>
  );
}
