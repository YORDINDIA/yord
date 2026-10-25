/**
 * The coupon-code format, shared by the promo field in the browser and the
 * routes that mint and redeem codes. Pure and isomorphic — no Supabase, no
 * `server-only` — so the input field can validate its own shape before a
 * request, while the server stays the authority on whether a code exists.
 *
 * Format: `AURA-` plus six characters. The prefix names the campaign so an
 * admin looking at an order can tell where a code came from without a join.
 */

/**
 * 32 characters — a power of two, which is what makes `generateCode`'s masking
 * unbiased (see below). `I`/`O`/`0`/`1` are absent because a shopper reading a
 * code off a phone screen types them wrong.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const CODE_PREFIX = 'AURA-';

export const CODE_LENGTH = 6;

/** Anchored, and built from the alphabet so the two cannot drift apart. */
export const CODE_RE = new RegExp(`^${CODE_PREFIX}[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/**
 * Uppercase and trim, but do not strip anything else: a code with a stray space
 * in the middle is a wrong code, and silently repairing it would hide a
 * mistyped character. `toUpperCase` alone is safe because the alphabet has no
 * case-sensitive members.
 */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

/** Shape check only. Says nothing about whether the code exists or is unspent. */
export function isValidCodeFormat(input: string): boolean {
  return CODE_RE.test(normalizeCode(input));
}

/**
 * A fresh code. `globalThis.crypto` is the Web Crypto API, present in the Node
 * 20 runtime these routes run in and in every browser — no import needed, and
 * no `node:crypto` in a module the client also loads.
 *
 * `byte & 31` is uniform *because* the alphabet is exactly 32 entries and 256
 * divides evenly by 32: every character gets the same eight source bytes. A
 * 26-letter alphabet would have needed rejection sampling to avoid favouring
 * the first six letters.
 */
export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let suffix = '';
  for (const byte of bytes) suffix += CODE_ALPHABET[byte & 31];
  return `${CODE_PREFIX}${suffix}`;
}

/** 32^6 ≈ 1.07e9 codes per campaign window. Used in the tests' collision note. */
export const CODE_SPACE = CODE_ALPHABET.length ** CODE_LENGTH;
