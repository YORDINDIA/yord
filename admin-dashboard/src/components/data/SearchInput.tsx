'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Debounced search box that writes `q` into the URL, so the server component
 * re-queries and the filter survives a refresh or a shared link.
 *
 * `delayMs={0}` submits on Enter/blur only, which is the right behavior for
 * list pages that also render a FilterBar submit button.
 *
 * The URL is the source of truth. When `q` changes from outside this input (a
 * filter reset, a pagination link, a shared URL), local state has to follow.
 *
 * This is done by adjusting state during render, not in an effect:
 *
 *  - The previous version put `key` on the returned `<form>`. That does
 *    nothing: a `key` is only meaningful among siblings, and this element has
 *    none, so React ignores it and the component is never remounted. The comment
 *    claimed a reset that did not happen.
 *  - The naive fix — `useEffect(() => setValue(current), [current])` — is
 *    what the lint rule correctly rejects, and it would also fight the debounce
 *    (every keystroke changes `current` once the router settles, re-rendering
 *    the input mid-typing).
 *
 * Comparing against the last observed `current` gives both: an external change
 * resyncs immediately, while the value this input itself just pushed to the URL
 * is already equal and causes no work. React supports setState-during-render for
 * this exact case and re-runs the component without committing a paint.
 */
export default function SearchInput({
  name = 'q',
  placeholder,
  delayMs = 350,
}: {
  name?: string;
  placeholder: string;
  delayMs?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get(name) ?? '';
  const [value, setValue] = useState(current);
  const [lastCurrent, setLastCurrent] = useState(current);

  if (current !== lastCurrent) {
    // An external change to the URL wins: resync so the input cannot push a
    // stale term back on the next debounce.
    setLastCurrent(current);
    setValue(current);
  }

  useEffect(() => {
    if (delayMs === 0) return;
    // `current` is read at debounce time, so this does not re-fire on every
    // keystroke that the URL has not caught up with yet.
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(name, value);
      else next.delete(name);
      // A filtered result set has no page 3; drop pagination on a new query.
      next.delete('page');
      const query = next.toString();
      router.replace(query ? `?${query}` : '?', { scroll: false });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, current, delayMs, name, params, router]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set(name, value.trim());
    else next.delete(name);
    next.delete('page');
    const query = next.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  }

  return (
    <form onSubmit={onSubmit} role="search" className="search-input">
      <input
        className="input"
        name={name}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {delayMs === 0 && (
        <button className="button" type="submit">
          Search
        </button>
      )}
    </form>
  );
}
