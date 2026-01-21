'use client';

import { CreditCard, Landmark, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PaymentMethod = 'razorpay' | 'upi' | 'netbanking' | 'cod';

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

export function PaymentSection({ selectedMethod, onMethodChange }: PaymentSectionProps) {
  return (
    <div className="space-y-6">
      <h3 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-50 mb-6">
        Payment Method
      </h3>

      <div className="space-y-3">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.id;

          return (
            <button
              key={method.id}
              onClick={() => onMethodChange(method.id)}
              className={cn(
                'w-full p-4 flex items-start gap-4 border transition-all text-left',
                isSelected
                  ? 'border-gold-200 bg-gold-200/5'
                  : 'border-noir-700 bg-noir-900 hover:border-ivory-500'
              )}
            >
              {/* Radio Circle */}
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                isSelected ? 'border-gold-200' : 'border-ivory-500'
              )}>
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-gold-200" />
                )}
              </div>

              {/* Icon */}
              <Icon className={cn(
                'w-6 h-6 flex-shrink-0',
                isSelected ? 'text-gold-200' : 'text-ivory-400'
              )} />

              {/* Content */}
              <div className="flex-1">
                <p className={cn(
                  'font-[family-name:var(--font-jakarta)] font-medium',
                  isSelected ? 'text-gold-200' : 'text-ivory-100'
                )}>
                  {method.name}
                </p>
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mt-0.5">
                  {method.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Secure Payment Notice */}
      <div className="flex items-center gap-2 text-ivory-500 font-[family-name:var(--font-jakarta)] text-xs">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Your payment information is encrypted and secure</span>
      </div>
    </div>
  );
}
