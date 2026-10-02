import Link from 'next/link';
import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2, EyeOff, FolderKanban, Plus, Sparkles } from 'lucide-react';
import CollectionsClient from './collections-client';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { getCollectionStats, listCollections } from '@/lib/data/collections';
import { SECTIONS } from '@/lib/sections';
import { COLLECTION_SCAN_LIMIT } from '@/lib/collection-list';
import { firstParam, pageCount } from '@/lib/pagination';
import { COLLECTION_SORTS, COLLECTION_TYPES, isOneOf } from '@/lib/constants';
import styles from './collections.module.css';

export const metadata: Metadata = { title: 'Collections · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Collection list.
 *
 * Was `.limit(100)` with no pager, so anything past 100 collections was
 * unreachable; and it skipped `.table-wrap`, so the table overflowed on narrow
 * screens instead of scrolling (the shared `DataTable` always wraps).
 *
 * The filters it now passes through are what make the catalog manageable:
 * an empty collection is visible (and refuses to publish) instead of
 * surfacing only as an empty storefront page.
 *
 * The stat strip comes from `getCollectionStats()` (two bounded queries), run
 * alongside `listCollections` since the reads are independent. When the scan
 * window is capped the numbers are floors, so the cards say "≥" rather than
 * implying an exact total.
 */
export default async function CollectionsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const publishedRaw = firstParam(resolved?.published);
  const typeRaw = firstParam(resolved?.type);
  const hasProductsRaw = firstParam(resolved?.hasProducts);
  const sortRaw = firstParam(resolved?.sort);

  // Narrow first, then derive the URL params from the narrowed values: keeping
  // one `Record<string, string>` for both the query and the pager is what
  // forced `as` casts and let an unknown `?sort=` reach listCollections.
  const q = firstParam(resolved?.q)?.trim() || undefined;
  const published: 'all' | 'yes' | 'no' =
    publishedRaw === 'yes' || publishedRaw === 'no' ? publishedRaw : 'all';
  const hasProducts: 'all' | 'yes' | 'no' =
    hasProductsRaw === 'yes' || hasProductsRaw === 'no' ? hasProductsRaw : 'all';
  const type: 'all' | (typeof COLLECTION_TYPES)[number] = isOneOf(COLLECTION_TYPES, typeRaw)
    ? typeRaw
    : 'all';
  const sort: (typeof COLLECTION_SORTS)[number] = isOneOf(COLLECTION_SORTS, sortRaw)
    ? sortRaw
    : 'updated_at';

  const [{ rows, count, page, pageSize, truncated }, stats] = await Promise.all([
    listCollections({
      q,
      published,
      type,
      hasProducts,
      sort,
      page: Number(firstParam(resolved?.page)) || 1,
    }),
    getCollectionStats(),
  ]);

  const params: Record<string, string | undefined> = {
    q,
    published: published === 'all' ? undefined : published,
    type: type === 'all' ? undefined : type,
    hasProducts: hasProducts === 'all' ? undefined : hasProducts,
    // The default sort is omitted so the URL stays clean.
    sort: sort === 'updated_at' ? undefined : sort,
  };

  const emptyCount = rows.filter((row) => row.productCount === 0 && !row.isAuto).length;
  // `stats.truncated` means the scan hit COLLECTION_SCAN_LIMIT, so every count
  // is a lower bound; `truncated` (the list's own flag) drives the notice below.
  const statsCapped = stats.truncated;

  return (
    <>
      <PageHeader
        icon={SECTIONS.collections.icon}
        title="Collections"
        description={SECTIONS.collections.description}
        actions={
          <Link className="button primary" href="/collections/new">
            <Plus size={14} aria-hidden />
            New collection
          </Link>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Total"
          value={statsCapped ? `≥ ${stats.total}` : stats.total}
          icon={FolderKanban}
          tone="slate"
          hint={statsCapped ? `First ${COLLECTION_SCAN_LIMIT} scanned` : 'All collections'}
        />
        <StatCard
          label="Published"
          value={statsCapped ? `≥ ${stats.published}` : stats.published}
          icon={CheckCircle2}
          tone="emerald"
          hint="Live on the storefront"
          href="/collections?published=yes"
        />
        <StatCard
          label="Unpublished"
          value={statsCapped ? `≥ ${stats.unpublished}` : stats.unpublished}
          icon={EyeOff}
          tone="amber"
          hint="Not live"
          href="/collections?published=no"
        />
        <StatCard
          label="Smart"
          value={statsCapped ? `≥ ${stats.smart}` : stats.smart}
          icon={Sparkles}
          tone="violet"
          hint="Rule-driven membership"
          href="/collections?type=smart"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="helper">
            {count} collections · page {page} of {pageCount(count, pageSize)}
            {emptyCount > 0 ? ` · ${emptyCount} empty on this page` : ''}
          </div>
        </div>
        {truncated && (
          <div className={`form-alert tone-amber ${styles.truncatedNote}`} role="status">
            <AlertTriangle size={15} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
            <span>
              This filter reads at most {COLLECTION_SCAN_LIMIT} collections, so the total and the
              pages below may be incomplete.
            </span>
          </div>
        )}

        <CollectionsClient
          rows={rows}
          count={count}
          page={page}
          pageSize={pageSize}
          params={params}
        />
      </div>
    </>
  );
}
