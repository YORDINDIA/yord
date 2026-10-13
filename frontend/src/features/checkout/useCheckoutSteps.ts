'use client';

import { useCallback, useState } from 'react';
import type { AddressData, CheckoutData, PaymentMethod } from './types';

export const CHECKOUT_STEPS = [
  { id: 1, name: 'Shipping', description: 'Delivery address' },
  { id: 2, name: 'Billing', description: 'Billing details' },
  { id: 3, name: 'Payment', description: 'Payment method' },
] as const;

export type CheckoutStepId = (typeof CHECKOUT_STEPS)[number]['id'];
export type AddressErrors = Partial<Record<keyof AddressData, string>>;

export const EMPTY_ADDRESS: AddressData = {
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+91)?[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

/** Field rules for one address. Pure, so a step can validate before advancing. */
export function validateAddress(address: AddressData): AddressErrors {
  const errors: AddressErrors = {};

  if (!address.firstName.trim()) errors.firstName = 'First name is required';
  if (!address.lastName.trim()) errors.lastName = 'Last name is required';
  if (!address.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_RE.test(address.email)) {
    errors.email = 'Invalid email address';
  }
  if (!address.phone.trim()) {
    errors.phone = 'Phone is required';
  } else if (!PHONE_RE.test(address.phone.replace(/\s/g, ''))) {
    errors.phone = 'Invalid phone number';
  }
  if (!address.address1.trim()) errors.address1 = 'Address is required';
  if (!address.city.trim()) errors.city = 'City is required';
  if (!address.state) errors.state = 'State is required';
  if (!address.pincode.trim()) {
    errors.pincode = 'PIN code is required';
  } else if (!PINCODE_RE.test(address.pincode)) {
    errors.pincode = 'Invalid PIN code';
  }

  return errors;
}

/**
 * Step, address and validation state for the checkout form.
 *
 * Split out of `CheckoutForm` so the form is rendering and navigation only,
 * and so "which fields does this step actually show?" is answerable in one
 * place: step 2 renders nothing when the billing address is the shipping one,
 * and validating a hidden address there produced an error nobody could see
 * while CONTINUE looked broken.
 */
export function useCheckoutSteps() {
  const [currentStep, setCurrentStep] = useState<CheckoutStepId>(1);
  const [shipping, setShipping] = useState<AddressData>(EMPTY_ADDRESS);
  const [billing, setBilling] = useState<AddressData>(EMPTY_ADDRESS);
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [errors, setErrors] = useState<AddressErrors>({});

  const toggleSameAsShipping = useCallback(
    (checked: boolean) => {
      setSameAsShipping(checked);
      if (checked) setBilling(shipping);
      setErrors({});
    },
    [shipping]
  );

  /**
   * Advance one step. Validates only what the current step renders, and
   * returns whether the step actually moved (the form moves focus when it did).
   */
  const goNext = useCallback((): boolean => {
    if (currentStep === 1) {
      const next = validateAddress(shipping);
      setErrors(next);
      if (Object.keys(next).length > 0) return false;
      if (sameAsShipping) setBilling(shipping);
      setCurrentStep(2);
      return true;
    }

    if (currentStep === 2) {
      // With "same as shipping" this step shows a read-only summary and no
      // inputs: the address was validated on step 1, so there is nothing here
      // to validate and nothing to show an error against.
      if (!sameAsShipping) {
        const next = validateAddress(billing);
        setErrors(next);
        if (Object.keys(next).length > 0) return false;
      } else {
        setErrors({});
      }
      setCurrentStep(3);
      return true;
    }

    return true;
  }, [currentStep, shipping, billing, sameAsShipping]);

  const goBack = useCallback(() => {
    setErrors({});
    setCurrentStep((step) => (step > 1 ? ((step - 1) as CheckoutStepId) : step));
  }, []);

  /** Jump to an earlier step (the Edit affordance). Forward jumps must re-validate. */
  const goToStep = useCallback((step: CheckoutStepId) => {
    setErrors({});
    setCurrentStep((current) => (step < current ? step : current));
  }, []);

  const step = CHECKOUT_STEPS.find((s) => s.id === currentStep) ?? CHECKOUT_STEPS[0];

  const data: CheckoutData = {
    shipping,
    billing: sameAsShipping ? shipping : billing,
    sameAsShipping,
    paymentMethod,
  };

  return {
    currentStep,
    step,
    shipping,
    billing,
    sameAsShipping,
    paymentMethod,
    errors,
    errorCount: Object.keys(errors).length,
    setShipping,
    setBilling,
    setPaymentMethod,
    toggleSameAsShipping,
    goNext,
    goBack,
    goToStep,
    data,
  };
}
