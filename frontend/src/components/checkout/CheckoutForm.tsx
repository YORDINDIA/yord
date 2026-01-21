'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { AddressForm, AddressData } from './AddressForm';
import { PaymentSection, PaymentMethod } from './PaymentSection';
import { cn } from '@/lib/utils';

interface CheckoutFormProps {
  onPlaceOrder: (data: CheckoutData) => Promise<void>;
  isProcessing: boolean;
}

export interface CheckoutData {
  shipping: AddressData;
  billing: AddressData;
  sameAsShipping: boolean;
  paymentMethod: PaymentMethod;
}

const STEPS = [
  { id: 1, name: 'Shipping', description: 'Delivery address' },
  { id: 2, name: 'Billing', description: 'Billing details' },
  { id: 3, name: 'Payment', description: 'Payment method' },
];

const emptyAddress: AddressData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
};

export function CheckoutForm({ onPlaceOrder, isProcessing }: CheckoutFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [shippingAddress, setShippingAddress] = useState<AddressData>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<AddressData>(emptyAddress);
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [errors, setErrors] = useState<Partial<Record<keyof AddressData, string>>>({});

  const validateAddress = (address: AddressData): boolean => {
    const newErrors: Partial<Record<keyof AddressData, string>> = {};

    if (!address.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!address.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!address.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!address.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^(\+91)?[6-9]\d{9}$/.test(address.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Invalid phone number';
    }
    if (!address.address1.trim()) newErrors.address1 = 'Address is required';
    if (!address.city.trim()) newErrors.city = 'City is required';
    if (!address.state) newErrors.state = 'State is required';
    if (!address.pincode.trim()) {
      newErrors.pincode = 'PIN code is required';
    } else if (!/^\d{6}$/.test(address.pincode)) {
      newErrors.pincode = 'Invalid PIN code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateAddress(shippingAddress)) {
        if (sameAsShipping) {
          setBillingAddress(shippingAddress);
        }
        setCurrentStep(2);
        setErrors({});
      }
    } else if (currentStep === 2) {
      const addressToValidate = sameAsShipping ? shippingAddress : billingAddress;
      if (validateAddress(addressToValidate)) {
        setCurrentStep(3);
        setErrors({});
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handlePlaceOrder = async () => {
    const data: CheckoutData = {
      shipping: shippingAddress,
      billing: sameAsShipping ? shippingAddress : billingAddress,
      sameAsShipping,
      paymentMethod,
    };
    await onPlaceOrder(data);
  };

  return (
    <div className="space-y-8">
      {/* Step Progress */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex flex-col items-center relative z-10',
                  index < STEPS.length - 1 ? 'flex-1' : ''
                )}
              >
                {/* Step Circle */}
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                  isCompleted
                    ? 'bg-gold-200 border-gold-200 text-noir-950'
                    : isCurrent
                    ? 'border-gold-200 text-gold-200 bg-transparent'
                    : 'border-noir-600 text-noir-500 bg-transparent'
                )}>
                  {isCompleted ? (
                    <Check size={20} />
                  ) : (
                    <span className="font-[family-name:var(--font-bebas)] text-lg">{step.id}</span>
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <p className={cn(
                    'font-[family-name:var(--font-jakarta)] text-sm font-medium',
                    isCurrent || isCompleted ? 'text-ivory-100' : 'text-ivory-500'
                  )}>
                    {step.name}
                  </p>
                  <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-500 hidden sm:block">
                    {step.description}
                  </p>
                </div>

                {/* Connector Line */}
                {index < STEPS.length - 1 && (
                  <div className="absolute top-5 left-[calc(50%+1.25rem)] w-[calc(100%-2.5rem)] h-0.5 -translate-y-1/2">
                    <div className={cn(
                      'h-full transition-colors',
                      isCompleted ? 'bg-gold-200' : 'bg-noir-700'
                    )} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-noir-900 border border-noir-800 p-6 md:p-8"
        >
          {currentStep === 1 && (
            <AddressForm
              type="shipping"
              data={shippingAddress}
              onChange={setShippingAddress}
              errors={errors}
            />
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Same as Shipping Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={(e) => {
                    setSameAsShipping(e.target.checked);
                    if (e.target.checked) {
                      setBillingAddress(shippingAddress);
                    }
                  }}
                  className="w-5 h-5 rounded border-noir-600 bg-noir-800 text-gold-200 focus:ring-gold-200 focus:ring-offset-noir-900"
                />
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-100">
                  Same as shipping address
                </span>
              </label>

              {!sameAsShipping && (
                <AddressForm
                  type="billing"
                  data={billingAddress}
                  onChange={setBillingAddress}
                  errors={errors}
                />
              )}

              {sameAsShipping && (
                <div className="p-4 bg-noir-800 border border-noir-700">
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-300">
                    {shippingAddress.firstName} {shippingAddress.lastName}
                  </p>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                    {shippingAddress.address1}
                    {shippingAddress.address2 && `, ${shippingAddress.address2}`}
                  </p>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                    {shippingAddress.city}, {shippingAddress.state} {shippingAddress.pincode}
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <PaymentSection
              selectedMethod={paymentMethod}
              onMethodChange={setPaymentMethod}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        {currentStep > 1 ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-6 py-3 border border-noir-600 text-ivory-300 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-ivory-400 hover:text-ivory-100 transition-colors"
          >
            <ChevronLeft size={18} />
            BACK
          </button>
        ) : (
          <div />
        )}

        {currentStep < 3 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
          >
            CONTINUE
            <ChevronRight size={18} />
          </button>
        ) : (
          <button
            onClick={handlePlaceOrder}
            disabled={isProcessing}
            className={cn(
              'flex items-center gap-2 px-8 py-3 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] transition-colors',
              isProcessing
                ? 'bg-noir-700 text-ivory-400 cursor-not-allowed'
                : 'bg-gold-200 text-noir-950 hover:bg-gold-300'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                PROCESSING...
              </>
            ) : (
              'PLACE ORDER'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
