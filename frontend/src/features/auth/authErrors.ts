/**
 * Supabase auth failures carry a stable `code` but a `message` that reads like
 * API output on some flows. Map the codes shoppers actually hit to storefront
 * copy; everything else keeps the server's own message — an unmapped error is
 * left as-is rather than guessed at.
 */
const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Please confirm your email address before signing in.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  user_exists: 'An account with this email already exists. Try signing in instead.',
  weak_password: 'That password is too weak — longer is stronger.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  over_email_send_rate_limit: 'Too many emails requested. Please wait a moment and try again.',
  user_banned: 'This account has been suspended. Please contact support.',
  same_password: 'The new password must be different from the current one.',
};

export function friendlyAuthError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') {
      const mapped = CODE_MESSAGES[code];
      if (mapped) return mapped;
    }
    return err.message;
  }
  return fallback;
}
