/**
 * Anti-enumeration guard for the register form.
 *
 * Supabase answers `signUp` for an already-registered email with no error, a
 * user whose `identities` is empty, and no email. If the form branched on that
 * signal, anyone could check which emails have an account. The form must show
 * one screen for both cases, and that screen must offer the ways in for an
 * existing account (sign in, reset password).
 *
 * The suite is node-only (no DOM), so this reads the component source.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'RegisterForm.tsx'),
  'utf8'
);

describe('RegisterForm', () => {
  it('does not branch on identities, so an existing email looks like a new one', () => {
    // Property access only (`user.identities`, `user?.identities`), so a
    // comment that mentions the word does not fail the guard.
    expect(source).not.toMatch(/\??\.identities\b/);
  });

  it('success screen links to sign in and to password reset', () => {
    const successScreen = source.slice(source.indexOf('if (success)'));
    expect(successScreen).toMatch(/href=\{loginHref\}/);
    expect(successScreen).toMatch(/href="\/auth\/forgot-password"/);
  });
});
