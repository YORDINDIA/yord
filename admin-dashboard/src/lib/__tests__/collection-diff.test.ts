import { describe, expect, it } from 'vitest';

import { diffMembership, hasRemovals, sampleWithTitles } from '@/lib/collection-diff';

/**
 * The arithmetic behind the smart-collection apply dialog.
 *
 * Applying rules replaces the whole `collects` set, so "+N / −N" is the only
 * warning the admin gets before members are dropped. These tests pin the
 * ordering contract (adds follow match order, removes follow current/position
 * order) because the dialog renders those ids as titled rows — a reshuffle
 * would read as churn that is not there.
 */

describe('diffMembership', () => {
  it('splits adds, removes and unchanged, preserving each side’s order', () => {
    const diff = diffMembership([4, 8, 15, 16], [15, 23, 4]);
    expect(diff.adds).toEqual([23]);
    expect(diff.removes).toEqual([8, 16]);
    expect(diff.unchanged).toBe(2);
  });

  it('treats an empty current set as all adds (a brand-new smart collection)', () => {
    const diff = diffMembership([], [7, 3]);
    expect(diff.adds).toEqual([7, 3]);
    expect(diff.removes).toEqual([]);
    expect(diff.unchanged).toBe(0);
  });

  it('treats an empty match as removing every member', () => {
    const diff = diffMembership([1, 2, 3], []);
    expect(diff.adds).toEqual([]);
    expect(diff.removes).toEqual([1, 2, 3]);
    expect(hasRemovals(diff)).toBe(true);
  });

  it('reports zero movement for identical sets', () => {
    const diff = diffMembership([9, 2], [9, 2]);
    expect(diff).toEqual({ adds: [], removes: [], unchanged: 2 });
    expect(hasRemovals(diff)).toBe(false);
  });
});

describe('sampleWithTitles', () => {
  const titles = new Map([
    [1, 'Coldplay Tee'],
    [2, 'Swift Hoodie'],
  ]);

  it('labels ids from the map and falls back to #id for missing rows', () => {
    expect(sampleWithTitles([1, 99], titles)).toEqual([
      { id: 1, title: 'Coldplay Tee' },
      { id: 99, title: '#99' },
    ]);
  });

  it('caps the sample at the limit', () => {
    const sample = sampleWithTitles([1, 2, 3, 4, 5, 6, 7], titles, 5);
    expect(sample).toHaveLength(5);
    expect(sample.map((entry) => entry.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('tolerates an empty id list', () => {
    expect(sampleWithTitles([], titles)).toEqual([]);
  });
});
