import type * as SentrySdk from '@sentry/nextjs';

/**
 * Shared Sentry options, consumed by the client/server/edge configs so all
 * three runtimes behave identically. The return type is `Sentry.init`'s own
 * parameter type, so the options can never drift from the SDK's contract.
 *
 * Free tier only: Sentry's paid features (tracing, session replay, profiling,
 * logs) are never enabled. `tracesSampleRate: 0` keeps tracing off, replay is
 * simply not installed, and no log integration is registered.
 *
 * `enabled` gates on two things: a configured DSN and a production build.
 * Local development and CI therefore never send events, so the free quota is
 * spent only on real users. To exercise Sentry locally, temporarily drop the
 * `NODE_ENV` check.
 */
export function sentryOptions(): Parameters<typeof SentrySdk.init>[0] {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    enabled: Boolean(dsn) && process.env.NODE_ENV === 'production',
    tracesSampleRate: 0,
    // The admin handles order and customer data; keep user identity out of
    // error reports (the SDK would otherwise attach it automatically).
    dataCollection: { userInfo: false },
  };
}
