import * as Sentry from '@sentry/nextjs';

/**
 * Picks the right Sentry config for the runtime a request lands in. The
 * Cloudflare Workers build runs with `nodejs_compat`, so it takes the
 * `nodejs` branch.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Reports errors thrown while rendering on the server (RSC payloads, server
 * actions) even when a route `error.tsx` boundary handles them for the user —
 * without this, a failed Supabase read that renders the error state would
 * never reach Sentry.
 */
export const onRequestError = Sentry.captureRequestError;
