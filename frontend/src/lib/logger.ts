// Structured server-side logging for API routes and data fetchers.
//
// Emits single-line JSON `{ route, code, detail }` via console.error/warn so
// log aggregators can filter by route + Supabase/PostgREST error code.
// UI contracts are unchanged: callers still return `[]` / `null` to the UI.

type LogLevel = 'error' | 'warn' | 'info';

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return 'UNKNOWN';
}

function errorDetail(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return redactSecrets(message).slice(0, 500);
  }
  try {
    return redactSecrets(JSON.stringify(error) ?? 'unknown error').slice(0, 500);
  } catch {
    return 'unknown error';
  }
}

/**
 * Scrub secret material before it reaches log aggregators. Covers the
 * Supabase service_role key name, the Razorpay key-secret env name,
 * Shopify (`shpat_`) and OpenAI (`sk-`) token prefixes, plus any
 * JWT-looking run (the service_role key itself is a JWT).
 */
function redactSecrets(value: string): string {
  return value
    .replace(/RAZORPAY_KEY_SECRET/gi, '[REDACTED]')
    .replace(/service_role/gi, '[REDACTED]')
    .replace(/shpat_[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
}

function emit(level: LogLevel, route: string, code: string, detail: unknown) {
  const payload = JSON.stringify({
    route,
    code,
    detail: typeof detail === 'string' ? redactSecrets(detail).slice(0, 500) : detail,
  });
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.log(payload);
}

/** Log a Supabase/PostgREST failure, extracting `error.code` when present. */
export function logDbError(route: string, error: unknown) {
  emit('error', route, errorCode(error), errorDetail(error));
}

/** Log a validation or business-rule failure with an explicit code. */
export function logWarn(route: string, code: string, detail: string) {
  emit('warn', route, code, detail);
}

/** Log an informational event with an explicit code. */
export function logInfo(route: string, code: string, detail: string) {
  emit('info', route, code, detail);
}
