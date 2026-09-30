import Link from 'next/link';
import { pageCount, qs } from '@/lib/pagination';

/**
 * "Showing N of M" + Previous/Next, built from the same helpers the pages use
 * to compute their window. Replaces three hand-rolled copies
 * (products:178, orders:125, customers:59).
 *
 * `pageParam` exists for pages carrying two independent paginated tables
 * (blogs + articles, product + article media). Sharing one `page` query
 * parameter between them means paging one table jumps the other, and a filter
 * that resets `page` resets both.
 */
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
  const to = Math.min(page, totalPages) * pageSize;

  return (
    <div className="pagination">
      <span className="helper">
        Showing {from}–{Math.max(from, to)} of {total} {label}
      </span>
      <div className="toolbar">
        {page > 1 && (
          <Link
            className="button"
            href={qs(basePath, params, { [pageParam]: page - 1 })}
            aria-label={`Previous page of ${label}`}
          >
            Previous
          </Link>
        )}
        <span className="helper" aria-live="polite">
          Page {page} of {totalPages}
        </span>
        {page < totalPages && (
          <Link
            className="button"
            href={qs(basePath, params, { [pageParam]: page + 1 })}
            aria-label={`Next page of ${label}`}
          >
            Next
          </Link>
        )}
      </div>
      {shown === 0 && total > 0 && <span className="helper">No rows on this page.</span>}
    </div>
  );
}
