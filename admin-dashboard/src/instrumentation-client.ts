import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './sentry-options';

Sentry.init(sentryOptions());

/**
 * Inert while `tracesSampleRate` is 0, but this is where App Router
 * navigations get instrumented if tracing is ever switched on.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
