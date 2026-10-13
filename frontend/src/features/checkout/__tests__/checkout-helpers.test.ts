// Checkout helpers: the order-name contract shared with whatever mints it,
// the delivery window derived from it, and the address rules the step machine
// validates with. All three are pure, so they are tested directly rather than
// through a rendered form.
import { describe, expect, it } from 'vitest';
import {
  estimatedDeliveryWindow,
  isYordOrderName,
  orderNameEpochSeconds,
  YORD_ORDER_NAME_RE,
} from '@/features/checkout/order';
import { validateAddress, EMPTY_ADDRESS } from '@/features/checkout/useCheckoutSteps';

describe('order name contract', () => {
  it('accepts what verify-payment mints and nothing else', () => {
    // `YORD-${epochSeconds}-${randomBytes(2).toString('hex').toUpperCase()}`
    expect(isYordOrderName('YORD-1759600000-A1B2')).toBe(true);
    // A bare epoch (track-order's numeric form) is not a confirmation.
    expect(isYordOrderName('1759600000')).toBe(false);
    expect(isYordOrderName('yord-1759600000-A1B2')).toBe(false);
    expect(isYordOrderName('YORD-PENDING')).toBe(false);
    expect(isYordOrderName(undefined)).toBe(false);
    expect(isYordOrderName(null)).toBe(false);
    expect(YORD_ORDER_NAME_RE.test('YORD-1759600000-A1B2')).toBe(true);
  });

  it('reads the order timestamp out of the name', () => {
    const epoch = Math.floor(Date.now() / 1000) - 3600;
    expect(orderNameEpochSeconds(`YORD-${epoch}-FFFF`)).toBe(epoch);
    // No embedded timestamp, or one that cannot be an order.
    expect(orderNameEpochSeconds('YORD-PENDING')).toBeNull();
    expect(orderNameEpochSeconds('YORD-0-FFFF')).toBeNull();
    const nextYear = Math.floor(Date.now() / 1000) + 400 * 24 * 60 * 60;
    expect(orderNameEpochSeconds(`YORD-${nextYear}-FFFF`)).toBeNull();
  });
});

describe('estimatedDeliveryWindow', () => {
  it('counts business days only, so a Friday order does not land on a Sunday', () => {
    // 2026-01-02 is a Friday.
    const friday = new Date('2026-01-02T10:00:00.000Z');
    const { start, end } = estimatedDeliveryWindow(friday);
    expect(start.getDay()).not.toBe(0);
    expect(start.getDay()).not.toBe(6);
    expect(end.getDay()).not.toBe(0);
    expect(end.getDay()).not.toBe(6);
    // Three business days from Friday: Wednesday 2026-01-07.
    expect(start.toISOString().slice(0, 10)).toBe('2026-01-07');
    // Seven: Monday 2026-01-13.
    expect(end.toISOString().slice(0, 10)).toBe('2026-01-13');
  });

  it('leaves the input date untouched', () => {
    const orderedAt = new Date('2026-01-02T10:00:00.000Z');
    estimatedDeliveryWindow(orderedAt);
    expect(orderedAt.toISOString()).toBe('2026-01-02T10:00:00.000Z');
  });
});

describe('validateAddress', () => {
  it('reports every missing required field on an empty address', () => {
    const errors = validateAddress(EMPTY_ADDRESS);
    expect(Object.keys(errors).sort()).toEqual([
      'address1',
      'city',
      'email',
      'firstName',
      'lastName',
      'phone',
      'pincode',
      'state',
    ]);
    // address2 is optional and never errors.
    expect(errors.address2).toBeUndefined();
  });

  it('enforces the Indian phone and PIN shapes', () => {
    const base = {
      ...EMPTY_ADDRESS,
      firstName: 'A',
      lastName: 'B',
      address1: '1 Road',
      city: 'Mumbai',
      state: 'Maharashtra',
    };
    expect(validateAddress({ ...base, email: 'a@b.in', phone: '9876543210', pincode: '400001' })).toEqual({});
    expect(validateAddress({ ...base, email: 'not-an-email', phone: '9876543210', pincode: '400001' })).toMatchObject({ email: 'Invalid email address' });
    expect(validateAddress({ ...base, email: 'a@b.in', phone: '12345', pincode: '400001' })).toMatchObject({ phone: 'Invalid phone number' });
    expect(validateAddress({ ...base, email: 'a@b.in', phone: '+91 98765 43210', pincode: '40001' })).toMatchObject({ pincode: 'Invalid PIN code' });
  });
});
