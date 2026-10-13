'use client';

import { Field, TextInput, SelectInput } from '@/features/ui/Field';
import { INDIAN_STATES } from './constants';
import type { AddressData } from './types';

export type { AddressData } from './types';

interface AddressFormProps {
  type: 'shipping' | 'billing';
  data: AddressData;
  onChange: (data: AddressData) => void;
  errors?: Partial<Record<keyof AddressData, string>>;
}

/**
 * Shipping / billing address, built from `Field`.
 *
 * Every label here used to be a bare `<label>` with no `htmlFor` and every
 * control a bare `<input>` with no `id`, so all ten of them were unlabelled to
 * a screen reader and clicking a label did not focus its field. `Field` owns
 * the id and the `htmlFor` together, so the association cannot drift again.
 *
 * The billing instance is the same component with `type="billing"`, which is
 * why the ids must be generated: two hand-written `id="email"` on one page
 * would collide.
 *
 * `autoComplete` and `inputMode` are the highest-leverage attributes on this
 * form — it is the highest-friction screen in the app, and without them every
 * shopper types their full address, phone and PIN by hand on a phone keypad.
 */
export function AddressForm({ type, data, onChange, errors = {} }: AddressFormProps) {
  const handleChange = (field: keyof AddressData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <h3 className="font-display text-xl text-text-primary mb-6">
        {type === 'shipping' ? 'Shipping Address' : 'Billing Address'}
      </h3>

      {/* Name Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First Name" name="firstName" required error={errors.firstName}>
          <TextInput
            type="text"
            autoComplete="given-name"
            value={data.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="John"
          />
        </Field>
        <Field label="Last Name" name="lastName" required error={errors.lastName}>
          <TextInput
            type="text"
            autoComplete="family-name"
            value={data.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Doe"
          />
        </Field>
      </div>

      {/* Contact Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Email" name="email" required error={errors.email}>
          <TextInput
            type="email"
            autoComplete="email"
            inputMode="email"
            value={data.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="john@example.com"
          />
        </Field>
        <Field label="Phone" name="phone" required error={errors.phone}>
          <TextInput
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={data.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+91 98765 43210"
          />
        </Field>
      </div>

      {/* Address */}
      <Field label="Address Line 1" name="address1" required error={errors.address1}>
        <TextInput
          type="text"
          autoComplete="address-line1"
          value={data.address1}
          onChange={(e) => handleChange('address1', e.target.value)}
          placeholder="House / flat number, street, area"
        />
      </Field>

      {/* Label and placeholder used to disagree here ("Address Line 2" vs
          "Landmark (optional)"); the label now says what the field is for. */}
      <Field label="Landmark (optional)" name="address2" error={errors.address2}>
        <TextInput
          type="text"
          autoComplete="address-line2"
          value={data.address2}
          onChange={(e) => handleChange('address2', e.target.value)}
          placeholder="Apartment, suite, nearby landmark"
        />
      </Field>

      {/* City, State, Pincode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="City" name="city" required error={errors.city}>
          <TextInput
            type="text"
            autoComplete="address-level2"
            value={data.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="Mumbai"
          />
        </Field>
        <Field label="State" name="state" required error={errors.state}>
          <SelectInput
            autoComplete="address-level1"
            value={data.state}
            onChange={(e) => handleChange('state', e.target.value)}
          >
            <option value="">Select State</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="PIN Code" name="pincode" required error={errors.pincode}>
          <TextInput
            type="text"
            autoComplete="postal-code"
            inputMode="numeric"
            value={data.pincode}
            onChange={(e) => handleChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="400001"
            maxLength={6}
          />
        </Field>
      </div>

      {/* Country */}
      <Field label="Country" name="country">
        <TextInput
          type="text"
          autoComplete="country-name"
          value="India"
          readOnly
          disabled
          className="opacity-50 cursor-not-allowed"
        />
      </Field>
    </div>
  );
}
