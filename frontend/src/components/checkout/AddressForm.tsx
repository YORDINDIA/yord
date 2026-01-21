'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface AddressData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface AddressFormProps {
  type: 'shipping' | 'billing';
  data: AddressData;
  onChange: (data: AddressData) => void;
  errors?: Partial<Record<keyof AddressData, string>>;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep'
];

export function AddressForm({ type, data, onChange, errors = {} }: AddressFormProps) {
  const handleChange = (field: keyof AddressData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const inputClass = (field: keyof AddressData) => cn(
    'w-full px-4 py-3 bg-noir-900 border text-ivory-100 placeholder:text-ivory-500',
    'font-[family-name:var(--font-jakarta)] text-sm',
    'focus:outline-none focus:border-gold-200 transition-colors',
    errors[field] ? 'border-red-500' : 'border-noir-700'
  );

  const labelClass = 'block text-ivory-300 font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider mb-2';

  return (
    <div className="space-y-6">
      <h3 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-50 mb-6">
        {type === 'shipping' ? 'Shipping Address' : 'Billing Address'}
      </h3>

      {/* Name Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>First Name *</label>
          <input
            type="text"
            value={data.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className={inputClass('firstName')}
            placeholder="John"
          />
          {errors.firstName && (
            <p className="text-red-400 text-xs mt-1">{errors.firstName}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Last Name *</label>
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className={inputClass('lastName')}
            placeholder="Doe"
          />
          {errors.lastName && (
            <p className="text-red-400 text-xs mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Contact Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Email *</label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={inputClass('email')}
            placeholder="john@example.com"
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Phone *</label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={inputClass('phone')}
            placeholder="+91 98765 43210"
          />
          {errors.phone && (
            <p className="text-red-400 text-xs mt-1">{errors.phone}</p>
          )}
        </div>
      </div>

      {/* Address */}
      <div>
        <label className={labelClass}>Address Line 1 *</label>
        <input
          type="text"
          value={data.address1}
          onChange={(e) => handleChange('address1', e.target.value)}
          className={inputClass('address1')}
          placeholder="Street address, apartment, suite, unit, etc."
        />
        {errors.address1 && (
          <p className="text-red-400 text-xs mt-1">{errors.address1}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Address Line 2</label>
        <input
          type="text"
          value={data.address2}
          onChange={(e) => handleChange('address2', e.target.value)}
          className={inputClass('address2')}
          placeholder="Landmark (optional)"
        />
      </div>

      {/* City, State, Pincode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>City *</label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className={inputClass('city')}
            placeholder="Mumbai"
          />
          {errors.city && (
            <p className="text-red-400 text-xs mt-1">{errors.city}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>State *</label>
          <select
            value={data.state}
            onChange={(e) => handleChange('state', e.target.value)}
            className={inputClass('state')}
          >
            <option value="">Select State</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          {errors.state && (
            <p className="text-red-400 text-xs mt-1">{errors.state}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>PIN Code *</label>
          <input
            type="text"
            value={data.pincode}
            onChange={(e) => handleChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={inputClass('pincode')}
            placeholder="400001"
            maxLength={6}
          />
          {errors.pincode && (
            <p className="text-red-400 text-xs mt-1">{errors.pincode}</p>
          )}
        </div>
      </div>

      {/* Country */}
      <div>
        <label className={labelClass}>Country</label>
        <input
          type="text"
          value="India"
          disabled
          className={cn(inputClass('country'), 'opacity-50 cursor-not-allowed')}
        />
      </div>
    </div>
  );
}
