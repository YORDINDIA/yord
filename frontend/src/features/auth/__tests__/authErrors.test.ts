import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from '../authErrors';

class AuthErrorStub extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

describe('friendlyAuthError', () => {
  it('maps known supabase auth codes to storefront copy', () => {
    expect(
      friendlyAuthError(new AuthErrorStub('invalid_credentials', 'Invalid login credentials'), 'fb'),
    ).toBe('Email or password is incorrect.');
    expect(
      friendlyAuthError(new AuthErrorStub('email_not_confirmed', 'Email not confirmed'), 'fb'),
    ).toBe('Please confirm your email address before signing in.');
    expect(
      friendlyAuthError(new AuthErrorStub('user_already_exists', 'User already registered'), 'fb'),
    ).toBe('An account with this email already exists. Try signing in instead.');
  });

  it('keeps the server message for unmapped codes and plain errors', () => {
    expect(friendlyAuthError(new AuthErrorStub('something_new', 'Server says'), 'fb')).toBe(
      'Server says',
    );
    expect(friendlyAuthError(new Error('boom'), 'fb')).toBe('boom');
  });

  it('falls back when the thrown value is not an Error', () => {
    expect(friendlyAuthError('nope', 'fb')).toBe('fb');
    expect(friendlyAuthError(null, 'fb')).toBe('fb');
  });
});
