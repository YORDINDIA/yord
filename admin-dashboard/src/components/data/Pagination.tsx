import Link from 'next/link';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageCount, qs } from '@/lib/pagination';

/**
 * "Showing N of M" + windowed page numbers (Previous, numbers, Next), built
 * from the same helpers the pages use to compute their window. Replaces three
 * hand-rolled copies (products:178, orders:125, customers:59).
 *
 * `pageParam` exists for pages carrying two independent paginated tables
 * (blogs + articles, product + article media). Sharing one `page` query
 * parameter between them means paging one table jumps the other, and a filter
 * that resets `page` resets both.
 *
 * Every number is a real `<Link>` built through `qs()`, so the filters, the
 * sort, and the other table's page survive a jump. The current page link is
 * marked `.active` + `aria-current`; it is a link to itself rather than inert
 * text, which keeps the row uniform and every number keyboard-reachable.
 */

/** Below this many pages, every number fits and ellipses would only cost space. */
const FLAT_PAGES = 7;
/** Numbers rendered on each side of the current page once the window kicks in. */
const NEIGHBOURS = 1;

/** `1 … 4 5 6 … 12`: always the first and last page, ellipses for the gaps. */
function pageItems(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= FLAT_PAGES) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const wanted = new Set([1, totalPages, page - NEIGHBOURS, page, page + NEIGHBOURS]);
  const numbers = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  let previous = 0;
  for (const n of numbers) {
    // A gap of one is not worth an ellipsis: it would replace the number it
    // stands for with the same width of text.
    if (n - previous > 1) items.push('gap');
    items.push(n);
    previous = n;
  }
  return items;
}

export default function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  shown,
  label,
  pageParam = 'page',
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  /** Rows rendered on this page (may be < pageSize on the last page). */
  shown: number;
  label: string;
  /** Query key this pager writes. Default `page`. */
  pageParam?: string;
}) {
  const totalPages = pageCount(total, pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  // Cap at the result count: rounding up to a full page overshoots on a
  // partial final page ("Showing 1–25 of 23").
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="helper">
        Showing {from}–{Math.max(from, to)} of {total} {label}
      </span>
      <nav className="toolbar" aria-label={`${label} pagination`}>
        {page > 1 && (
          <Link
            className="button small"
            href={qs(basePath, params, { [pageParam]: page - 1 })}
            aria-label={`Previous page of ${label}`}
          >
            <ChevronLeft size={13} aria-hidden />
            Previous
          </Link>
        )}
        <span className="page-numbers">
          {pageItems(page, totalPages).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="page-number ellipsis" aria-hidden>
                …
              </span>
            ) : (
              <Link
                key={item}
                className={clsx('page-number', item === page && 'active')}
                href={qs(basePath, params, { [pageParam]: item })}
                aria-label={`Page ${item} of ${totalPages}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </Link>
            ),
          )}
        </span>
        {page < totalPages && (
          <Link
            className="button small"
            href={qs(basePath, params, { [pageParam]: page + 1 })}
            aria-label={`Next page of ${label}`}
          >
            Next
            <ChevronRight size={13} aria-hidden />
          </Link>
        )}
        {/* The numbers carry this visually; announce it for screen readers. */}
        <span className="sr-only" aria-live="polite">
          Page {page} of {totalPages}
        </span>
      </nav>
      {shown === 0 && total > 0 && <span className="helper">No rows on this page.</span>}
    </div>
  );
}
