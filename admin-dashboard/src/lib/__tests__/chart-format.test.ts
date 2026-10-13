import { describe, expect, it } from 'vitest';
import {
  compactCurrency,
  compactNumber,
  formatDayLabel,
  percentDelta,
} from '@/lib/chart-format';
import { formatCurrency } from '@/lib/utils/format';

/**
 * The chart set formats a tick or a tooltip on every render, so these helpers
 * are the one place a number becomes text. The cases below are the two that
 * bit the dashboards before: a UTC date shifting a day in IST, and an axis
 * showing "NaN" for an empty series.
 */

describe('compactNumber', () => {
  it('uses the Indian ladder for money-sized numbers', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1000)).toBe('1K');
    expect(compactNumber(1234)).toBe('1.2K');
    expect(compactNumber(120000)).toBe('1.2L');
    expect(compactNumber(15000000)).toBe('1.5Cr');
  });

  it('keeps the sign', () => {
    expect(compactNumber(-120000)).toBe('-1.2L');
  });

  it('renders an em dash for non-finite input instead of "NaN"', () => {
    expect(compactNumber(Number.NaN)).toBe('—');
    expect(compactNumber(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('compactCurrency', () => {
  it('renders a compact rupee form', () => {
    expect(compactCurrency(450)).toBe('₹450');
    expect(compactCurrency(1234)).toBe('₹1.2K');
    expect(compactCurrency(120000)).toBe('₹1.2L');
    expect(compactCurrency(15000000)).toBe('₹1.5Cr');
  });

  it('does not apply lakh/crore units to other currencies', () => {
    expect(compactCurrency(120000, 'USD')).toBe('$120K');
    expect(compactCurrency(15000000, 'USD')).toBe('$15M');
  });

  it('falls back to the full currency format for a code Intl rejects', () => {
    expect(compactCurrency(450, 'NOPE')).toBe(formatCurrency(450, 'NOPE'));
  });

  it('renders an em dash for non-finite input', () => {
    expect(compactCurrency(Number.NaN)).toBe('—');
  });
});

describe('formatDayLabel', () => {
  it('renders day and month without a leading zero', () => {
    expect(formatDayLabel('2024-10-12')).toBe('12 Oct');
    expect(formatDayLabel('2024-01-05')).toBe('5 Jan');
  });

  it('does not shift the day when the viewer is not in UTC', () => {
    // Built from Date.UTC and formatted with timeZone: 'UTC'; a local-zone
    // parse would render 11 Oct for an IST viewer.
    expect(formatDayLabel('2024-10-12')).toBe(
      new Date(Date.UTC(2024, 9, 12)).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    );
  });

  it('accepts a full ISO timestamp', () => {
    expect(formatDayLabel('2024-10-12T09:30:00Z')).toBe('12 Oct');
  });

  it('passes anything unparseable through untouched', () => {
    expect(formatDayLabel('this week')).toBe('this week');
    expect(formatDayLabel('')).toBe('');
    expect(formatDayLabel('2024-13-01')).toBe('2024-13-01');
    expect(formatDayLabel('2024-02-32')).toBe('2024-02-32');
  });
});

describe('percentDelta', () => {
  it('is flat with an em dash when there is no previous value', () => {
    expect(percentDelta(500, 0)).toEqual({ direction: 'flat', value: '—' });
  });

  it('is flat at zero change', () => {
    expect(percentDelta(250, 250)).toEqual({ direction: 'flat', value: '0.0%' });
  });

  it('reports up and down with one decimal, unsigned', () => {
    expect(percentDelta(110, 100)).toEqual({ direction: 'up', value: '10.0%' });
    expect(percentDelta(90, 100)).toEqual({ direction: 'down', value: '10.0%' });
    expect(percentDelta(1015, 1000)).toEqual({ direction: 'up', value: '1.5%' });
  });

  it('treats a change smaller than 0.05% as flat', () => {
    expect(percentDelta(100.04, 100)).toEqual({ direction: 'flat', value: '0.0%' });
  });

  it('reads a negative number getting less negative as up', () => {
    expect(percentDelta(-50, -100)).toEqual({ direction: 'up', value: '50.0%' });
  });

  it('is flat with an em dash for non-finite input', () => {
    expect(percentDelta(Number.NaN, 100)).toEqual({ direction: 'flat', value: '—' });
    expect(percentDelta(100, Number.POSITIVE_INFINITY)).toEqual({ direction: 'flat', value: '—' });
  });
});
