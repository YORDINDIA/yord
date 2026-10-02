import type { AnalyticsEvent, TrackableEvent } from './eventsSchema';

/**
 * First-party behavioral analytics collector.
 *
 * `track()` queues an event and the queue flushes to
 * `POST /api/analytics/events` — at 20 events, 5 s after the first queued
 * event, or on page hide (`sendBeacon`, falling back to `keepalive` fetch).
 * Batching keeps a browsing session to a handful of requests instead of one
 * per interaction.
 *
 * Contract with callers (the Zustand stores, page trackers, checkout): this
 * module never throws and never awaits. Analytics must not be able to break
 * a cart add or a checkout, and tests importing those modules in a Node
 * environment no-op here because every entry point guards on `window`.
 *
 * No PostHog here on purpose: behavioral events are first-party only
 * (spec decision). PostHog keeps its own `$pageview` + identify wiring.
 */

const ENDPOINT = '/api/analytics/events';
const SID_STORAGE_KEY = 'yord-sid';
const FLUSH_SIZE = 20;
const FLUSH_DELAY_MS = 5000;

let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sessionReferrer: string | undefined;
let cachedSid: string | undefined;

/**
 * Stable per-browser id, created once and kept in localStorage. A random UUID
 * on purpose: it is never the auth user id, so events cannot be joined to
 * `customers` — the admin sees browsers, not identities.
 */
export function analyticsSessionId(): string {
  if (typeof window === 'undefined') return '00000000-0000-4000-8000-000000000000';
  if (cachedSid) return cachedSid;
  try {
    const existing = window.localStorage.getItem(SID_STORAGE_KEY);
    if (existing) {
      cachedSid = existing;
      return existing;
    }
    const sid = window.crypto.randomUUID();
    window.localStorage.setItem(SID_STORAGE_KEY, sid);
    cachedSid = sid;
    return sid;
  } catch {
    // Storage blocked (private mode quota, disabled storage): fall back to a
    // per-page-load id. Still a valid uuid-shaped string, just not stable.
    cachedSid ??= window.crypto.randomUUID();
    return cachedSid;
  }
}

/**
 * The document referrer at first event time, as an origin. Same-origin
 * referrers (in-app navigation) and opaque origins become null — only
 * external traffic sources are worth the bytes.
 */
function externalReferrer(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const raw = document.referrer;
    if (!raw) return undefined;
    const origin = new URL(raw).origin;
    if (!origin || origin === window.location.origin) return undefined;
    return origin;
  } catch {
    return undefined;
  }
}

/**
 * Queue one event. Base fields (`sid`, `path`, `referrer`) are attached here
 * so call sites pass only what happened: `track({ type: 'add_to_cart', ... })`.
 */
export function track(event: TrackableEvent): void {
  if (typeof window === 'undefined') return;
  try {
    sessionReferrer ??= externalReferrer();
    queue.push({
      ...event,
      sid: analyticsSessionId(),
      path: window.location.pathname,
      referrer: sessionReferrer,
    });
    if (queue.length >= FLUSH_SIZE) {
      void flushAnalytics();
      return;
    }
    flushTimer ??= setTimeout(() => {
      flushTimer = null;
      void flushAnalytics();
    }, FLUSH_DELAY_MS);
  } catch {
    // Analytics must never break the interaction that produced it.
  }
}

/** Last key seen by `trackIfNew`, so repeated mounts of a tracker (React
 * StrictMode double-invokes effects in dev) fire once per navigation. */
let lastTrackedKey: string | null = null;

/**
 * Fire `event` only when `key` differs from the previous call. Page and
 * product views are navigation-scoped: the same page remounting must not
 * count twice, but navigating away and back is a real view.
 */
export function trackIfNew(key: string, event: TrackableEvent): void {
  if (lastTrackedKey === key) return;
  lastTrackedKey = key;
  track(event);
}

/**
 * Send the queued batch. `sendBeacon` first (survives page unload without
 * keeping the tab alive), then `fetch` with `keepalive` for environments
 * without it. Any failure — offline, 4xx, 5xx — drops the batch: there is no
 * retry queue, because a poisoned event would retry forever against a
 * validating endpoint.
 */
export async function flushAnalytics(): Promise<void> {
  if (typeof window === 'undefined' || queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    const body = JSON.stringify({ events: batch });
    const blob = new Blob([body], { type: 'application/json' });
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(ENDPOINT, blob)) {
      return;
    }
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Dropped, by design.
  }
}

if (typeof window !== 'undefined') {
  const flushOnHide = () => {
    if (queue.length === 0) return;
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushAnalytics();
  };
  window.addEventListener('pagehide', flushOnHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnHide();
  });
}
