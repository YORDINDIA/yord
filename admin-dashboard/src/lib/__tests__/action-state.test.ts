import { describe, expect, it } from 'vitest';
import { actionError, actionFieldErrors, actionOk } from '@/lib/action-state';

/**
 * The one return shape every admin server action uses.
 *
 * Previously 14 inline `'use server'` actions returned `undefined` (or a bare
 * `{ error }`), so a failed write re-rendered the form identically and the admin
 * concluded the save succeeded. These pin the three outcomes a caller must be
 * able to tell apart: idle, success, and error (banner and/or per-field).
 */
describe('actionOk', () => {
  it('is a success state carrying a message and optional payload', () => {
    const state = actionOk<{ id: number }>('Saved.', { id: 7 });
    expect(state.status).toBe('success');
    expect(state.message).toBe('Saved.');
    expect(state.data).toEqual({ id: 7 });
    expect(state.formError).toBeUndefined();
  });

  it('allows a message-less success', () => {
    expect(actionOk().status).toBe('success');
  });
});

describe('actionError', () => {
  it('is an error state with a form-level message', () => {
    const state = actionError('Could not save. Nothing was changed.');
    expect(state.status).toBe('error');
    expect(state.formError).toBe('Could not save. Nothing was changed.');
    expect(state.data).toBeUndefined();
  });

  it('can carry both a banner and field errors', () => {
    const state = actionError('Check the highlighted fields.', { title: ['Title is required.'] });
    expect(state.formError).toBe('Check the highlighted fields.');
    expect(state.fieldErrors?.title).toEqual(['Title is required.']);
  });
});

describe('actionFieldErrors', () => {
  it('is an error state with per-field messages and no banner', () => {
    const state = actionFieldErrors({ title: ['Title is required.'] });
    expect(state.status).toBe('error');
    expect(state.formError).toBeUndefined();
    expect(state.fieldErrors?.title).toEqual(['Title is required.']);
  });
});
