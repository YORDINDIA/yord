export type PostJsonResult<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * POST a JSON body from a client component.
 *
 * Collapses the fetch / `json().catch` / `!ok` / network-error ladder into one
 * result, so callers only branch on `ok`. Error text prefers the route's
 * `message`, then its legacy `error` string, then `failMessage`.
 */
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  failMessage = 'Request failed.',
): Promise<PostJsonResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, message: data.message || data.error || failMessage };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, message: 'Network error, try again.' };
  }
}
