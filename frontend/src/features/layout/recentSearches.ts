const RECENT_KEY = 'yord-recent-searches';
const MAX_RECENT = 4;

/**
 * Recent search terms, on the visitor's own device. `localStorage` throws in
 * private mode, so both directions are guarded — losing recent searches is a
 * convenience, not a failure worth surfacing.
 */
export function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? 'null');
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

export function rememberSearch(term: string): void {
  const next = [term, ...readRecentSearches().filter((value) => value !== term)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable.
  }
}
