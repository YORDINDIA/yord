/**
 * PostgREST filter escaping for raw user input. Server or client safe (pure
 * string ops). Used by search, track-order, and product filter queries.
 */

/**
 * Sanitize user input for PostgREST `or()` ilike patterns.
 * Values are double-quoted so commas/parens stay literal; backslashes,
 * quotes, and LIKE wildcards (%, _) are escaped. Capped at 100 chars.
 */
export function sanitizeOrPattern(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, '\\$&')
    .slice(0, 100);
}

/** Build a multi-column ilike `or()` filter safe for raw user input. */
export function buildSearchOrFilter(query: string): string {
  const q = sanitizeOrPattern(query.trim());
  return `title.ilike."%${q}%",vendor.ilike."%${q}%",tags.ilike."%${q}%"`;
}

/** Escape LIKE wildcards so names match literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
