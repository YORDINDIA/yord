'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatPrice } from '@yord/ui';
import { Button } from '@/features/ui/Button';
import { FormBanner } from '@/features/ui/FormBanner';
import { Reveal } from '@/features/ui/Reveal';
import { AddressForm } from './AddressForm';
import { PaymentSection } from './PaymentSection';
import { CheckoutStepper } from './CheckoutStepper';
import {
  CHECKOUT_STEPS,
  useCheckoutSteps,
  type CheckoutStepId,
} from './useCheckoutSteps';
import type { CheckoutData } from './types';

export type { CheckoutData } from './types';

interface CheckoutFormProps {
  onPlaceOrder: (data: CheckoutData) => Promise<void>;
  isProcessing: boolean;
  /** Order total, shown on PLACE ORDER so the final click states the amount. */
  total: number;
}

const STEP_HEADING_ID = 'checkout-step-heading';

/**
 * Shipping → billing → payment, one step at a time.
 *
 * Rendering and navigation only: the step state, the field rules and the
 * "which fields does this step actually show" question live in
 * `useCheckoutSteps`. Two behaviours are load-bearing here — focus moves to
 * the new step's first control on advance (otherwise a keyboard user is left
 * on a button while the panel they just opened is somewhere below), and the
 * CONTINUE/PLACE ORDER row is sticky at the bottom of the viewport on phones,
 * where the form is taller than the screen.
 */
export function CheckoutForm({ onPlaceOrder, isProcessing, total }: CheckoutFormProps) {
  const {
    currentStep,
    step,
    shipping,
    billing,
    sameAsShipping,
    paymentMethod,
    errors,
    errorCount,
    setShipping,
    setBilling,
    setPaymentMethod,
    toggleSameAsShipping,
    goNext,
    goBack,
    goToStep,
    data,
  } = useCheckoutSteps();

  const panelRef = useRef<HTMLDivElement>(null);
  // Set only when the shopper advances, so the first render and a BACK do not
  // steal focus from wherever the shopper is.
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    // A field first (the point of moving focus), a control second: step 3
    // leads with its EDIT button, which is not where the shopper is going.
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>('input, select, textarea') ??
      panel?.querySelector<HTMLElement>('button, a[href]');
    target?.focus();
  }, [currentStep]);

  const handleNext = () => {
    if (goNext()) moveFocus.current = true;
  };

  const handleEditShipping = () => {
    goToStep(1);
    moveFocus.current = true;
  };

  return (
    <div className="space-y-8">
      <CheckoutStepper
        steps={CHECKOUT_STEPS}
        current={currentStep}
        onStepClick={(id) => goToStep(id as CheckoutStepId)}
      />

      {/* Validation summary. Field-level errors are announced by `Field`; this
          is the one place that says *how many* are waiting and that CONTINUE
          did something. */}
      {errorCount > 0 && (
        <FormBanner tone="danger">
          {errorCount === 1
            ? 'Please fix the highlighted field below before continuing.'
            : `Please fix the ${errorCount} highlighted fields below before continuing.`}
        </FormBanner>
      )}

      <h2 id={STEP_HEADING_ID} className="sr-only">
        {step.name}: {step.description}
      </h2>
      <div ref={panelRef} role="group" aria-labelledby={STEP_HEADING_ID}>
        <Reveal
          key={currentStep}
          className="bg-surface-card border border-border-default p-6 md:p-8"
        >
          {currentStep === 1 && (
            <AddressForm
              type="shipping"
              data={shipping}
              onChange={setShipping}
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
                  onChange={(e) => toggleSameAsShipping(e.target.checked)}
                  className="w-5 h-5 rounded accent-accent"
                />
                <span className="font-body text-text-secondary">
                  Same as shipping address
                </span>
              </label>

              {!sameAsShipping && (
                <AddressForm
                  type="billing"
                  data={billing}
                  onChange={setBilling}
                  errors={errors}
                />
              )}

              {sameAsShipping && (
                <div className="p-4 bg-surface-raised border border-border-default">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-body text-sm text-text-secondary">
                        {shipping.firstName} {shipping.lastName}
                      </p>
                      <p className="font-body text-sm text-text-muted">
                        {shipping.address1}
                        {shipping.address2 && `, ${shipping.address2}`}
                      </p>
                      <p className="font-body text-sm text-text-muted">
                        {shipping.city}, {shipping.state} {shipping.pincode}
                      </p>
                      <p className="font-body text-sm text-text-muted">
                        {shipping.phone}
                      </p>
                    </div>
                    {/* Without this the only way back to the address was BACK,
                        one step at a time. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleEditShipping}
                    >
                      EDIT
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 border border-border-default bg-surface-raised p-4">
                <div className="space-y-1">
                  <p className="font-body text-xs uppercase tracking-wider text-text-muted">
                    Delivering to
                  </p>
                  <p className="font-body text-sm text-text-secondary">
                    {shipping.firstName} {shipping.lastName} · {shipping.city}{' '}
                    {shipping.pincode}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleEditShipping}
                >
                  EDIT
                </Button>
              </div>

              <PaymentSection
                selectedMethod={paymentMethod}
                onMethodChange={setPaymentMethod}
              />
            </div>
          )}
        </Reveal>
      </div>

      {/* Navigation. Sticky on phones (the form is taller than the viewport
          there) and a plain row from `lg` up. */}
      <div
        className={cn(
          'flex items-center justify-between gap-4',
          'sticky bottom-0 z-20 -mx-6 border-t border-border-default bg-surface-page/95 px-6 py-4 backdrop-blur',
          'lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none'
        )}
      >
        {currentStep > 1 ? (
          <Button type="button" variant="secondary" onClick={goBack}>
            <ChevronLeft size={18} aria-hidden="true" />
            BACK
          </Button>
        ) : (
          <div />
        )}

        {currentStep < 3 ? (
          <Button type="button" variant="primary" onClick={handleNext}>
            CONTINUE
            <ChevronRight size={18} aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="gold"
            isLoading={isProcessing}
            onClick={() => onPlaceOrder(data)}
          >
            PLACE ORDER · {formatPrice(total)}
          </Button>
        )}
      </div>
    </div>
  );
}
