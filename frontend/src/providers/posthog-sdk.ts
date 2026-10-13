/**
 * The PostHog SDK, loaded and initialised on demand.
 *
 * Analytics are optional: they stay off unless a real project key was inlined
 * at build time. Three callers need the SDK — `PHProvider` (init),
 * `PostHogPageView` (`$pageview`) and `useAuth` (identify/reset) — and each of
 * them used to import `posthog-js` at module scope, which put the whole SDK
 * (~62 KB brotli) into the initial bundle of every page for a key that is
 * usually absent. They now share this loader, which resolves to `null` when
 * there is no usable key.
 *
 * `loadPostHog()` resolves only after `init()` has run, so a caller can never
 * hit posthog-js's "You must initialize PostHog before calling …" path.
 */

const PLACEHOLDER_KEY_MARKER = 'xxxx';

/** A key that is missing, empty, or still the `.env.example` placeholder. */
export function isUsableKey(key: string | undefined): key is string {
  const trimmed = key?.trim();
  return Boolean(
    trimmed &&
      trimmed.startsWith('phc_') &&
      !trimmed.includes(PLACEHOLDER_KEY_MARKER),
  );
}

export type PostHogSdk = (typeof import('posthog-js'))['default'];

/** True when a real key was inlined at build time. */
export function postHogEnabled(): boolean {
  return isUsableKey(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

// Module scope, because React StrictMode remounts the provider in dev and a
// second `posthog.init()` on the same instance is not a supported call.
let sdk: Promise<PostHogSdk | null> | null = null;

/**
 * The initialised SDK, or `null` when PostHog is off. Safe to call from any
 * number of callers: the import and `init()` happen once.
 */
export function loadPostHog(): Promise<PostHogSdk | null> {
  sdk ??= initPostHog();
  return sdk;
}

async function initPostHog(): Promise<PostHogSdk | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!isUsableKey(key)) return null;

  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || undefined,
      person_profiles: 'identified_only',
      capture_pageview: false, // PostHogPageView captures manually.
      // No flags request (that endpoint is what 401'd on the placeholder key),
      // no autocapture, no session recording: recording is a privacy and weight
      // decision, and desktop-only recording can be enabled later with
      // `disable_session_recording: false` plus masking
      // (`session_recording: { maskAllInputs: true }`).
      advanced_disable_flags: true,
      autocapture: false,
      disable_session_recording: true,
    });
    return posthog;
  } catch {
    // A failed chunk fetch must not surface as a console error: analytics never
    // justify breaking the Lighthouse console check.
    return null;
  }
}
