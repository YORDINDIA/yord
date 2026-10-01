'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import SearchInput from './SearchInput';

/**
 * Filter form shared by every list page. Submits as a GET so a filtered list is
 * a shareable URL, and resets `page` (a page-3 filter result has no page 3).
 */
export default function FilterBar({
  children,
  submitLabel = 'Apply',
}: {
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      const asString = String(value);
      if (!asString) continue;
      // `all` means "no filter" for selects — except a literal search for the
      // word "all", which must survive like any other query.
      if (asString === 'all' && key !== 'q') continue;
      next.set(key, asString);
    }
    // Keep sort/direction when filtering — but only when the submitted form
    // has no field of its own for them. The Products bar submits `sort`
    // itself; overwriting it with the previous URL value pinned the old sort
    // no matter what the admin just picked.
    const sort = params.get('sort');
    const dir = params.get('dir');
    if (sort && !next.has('sort')) next.set('sort', sort);
    if (dir && !next.has('dir')) next.set('dir', dir);
    const query = next.toString();
    router.push(query ? `?${query}` : '?', { scroll: false });
  }

  return (
    <form className="toolbar filter-bar" onSubmit={onSubmit} role="search">
      {children}
      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}

/** Standard `<select>` of enum values plus an "all" option. */
export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly string[] | readonly { value: string; label: string }[];
}) {
  return (
    <select className="select" name={name} defaultValue={value} aria-label={label}>
      {options.map((option) => {
        const optionValue = typeof option === 'string' ? option : option.value;
        const optionLabel =
          typeof option === 'string'
            ? option === 'all'
              ? 'All'
              : option.replace(/_/g, ' ')
            : option.label;
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  );
}

export { SearchInput };
