import { sentryOptions } from './sentry-options';

type SentrySdk = typeof import('@sentry/nextjs');

/**
 * The client SDK is loaded from an idle callback, and only when a DSN is
 * configured for a production build. Without one (the deployed default) the
 * ~110 KB bundle used to be parsed and executed on every page for nothing.
 *
 * Trade-off: errors thrown before the idle callback runs are not captured by
 * the client SDK. Server-render errors still are, via `onRequestError` in
 * `src/instrumentation.ts`.
 */
let sentry: SentrySdk | null = null;

async function initSentry(): Promise<void> {
  const options = sentryOptions();
  // `enabled` is the shared gate: a real DSN AND `NODE_ENV === 'production'`.
  if (!options.enabled) return;

  sentry ??= await import('@sentry/nextjs');
  sentry.init(options);
}

if (typeof window !== 'undefined') {
  const start = () => {
    // A failed chunk fetch must not surface as a console error.
    void initSentry().catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 3000 });
  } else {
    window.setTimeout(start, 2000);
  }
}

/**
 * Next 16 calls this on App Router navigations. Inert until the SDK has been
 * loaded and initialised (and `tracesSampleRate: 0` keeps it a no-op anyway,
 * but this is where navigations get instrumented if tracing is switched on).
 */
export function onRouterTransitionStart(
  ...args: Parameters<SentrySdk['captureRouterTransitionStart']>
): void {
  if (!sentry) return;
  sentry.captureRouterTransitionStart(...args);
}
