import { describe, expect, it } from 'vitest';
import { formatDiscountValue, formatWindow, suggestCode } from './format';

/**
 * Discount formatting.
 *
 * Both helpers are used by two surfaces that must agree: the server-rendered
 * list and the client-rendered preview card. Dates are built with local
 * constructors so the expectations do not depend on the runner's time zone, and
 * `formatWindow` is fed ISO strings because that is what the database stores.
 */
const iso = (year: number, month: number, day: number) =>
  new Date(year, month, day, 10, 0, 0).toISOString();

describe('formatDiscountValue', () => {
  it('renders a percentage with a % suffix', () => {
    expect(formatDiscountValue(10, 'percentage')).toBe('10%');
    expect(formatDiscountValue(12.5, 'percentage')).toBe('12.5%');
    expect(formatDiscountValue('10.00', 'percentage')).toBe('10%');
  });

  it('renders a fixed amount in rupees, without forced decimals', () => {
    expect(formatDiscountValue(500, 'fixed_amount')).toBe('₹500');
    expect(formatDiscountValue(499.5, 'fixed_amount')).toBe('₹499.5');
    expect(formatDiscountValue(1234.75, 'fixed_amount')).toBe('₹1,234.75');
  });

  it('falls back to an em dash for a missing or unparsable value', () => {
    expect(formatDiscountValue(null, 'percentage')).toBe('—');
    expect(formatDiscountValue('', 'fixed_amount')).toBe('—');
    expect(formatDiscountValue('abc', 'percentage')).toBe('—');
  });
});

describe('formatWindow', () => {
  it('drops the year when both ends share it', () => {
    expect(formatWindow(iso(2026, 8, 1), iso(2026, 8, 30))).toBe('1 Sept → 30 Sept');
  });

  it('keeps both years when the window crosses one', () => {
    expect(formatWindow(iso(2025, 11, 31), iso(2026, 0, 3))).toBe('31 Dec 2025 → 3 Jan 2026');
  });

  it('marks a rule with no end as open ended', () => {
    expect(formatWindow(iso(2026, 8, 1), null)).toBe('1 Sept 2026 → Open ended');
  });

  it('treats an empty window as always on', () => {
    expect(formatWindow(null, null)).toBe('Always on');
    expect(formatWindow('', '')).toBe('Always on');
  });
});

describe('suggestCode', () => {
  it('uppercases and joins words with a dash', () => {
    expect(suggestCode('Diwali Sale 2026')).toBe('DIWALI-SALE-2026');
  });

  it('drops everything outside the schema character set', () => {
    expect(suggestCode('Coldplay — Night 1!')).toBe('COLDPLAY-NIGHT-1');
    expect(suggestCode('50% off_all')).toBe('50-OFF_ALL');
  });

  it('never leaves a leading or trailing separator', () => {
    expect(suggestCode('  sale  ')).toBe('SALE');
    expect(suggestCode('%')).toBe('');
  });

  it('caps the length at the schema maximum', () => {
    expect(suggestCode('a'.repeat(100))).toHaveLength(64);
  });
});
