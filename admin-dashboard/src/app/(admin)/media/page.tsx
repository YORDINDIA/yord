import type { Metadata } from 'next';
import {
  HardDrive,
  ImagePlus,
  Images,
  Newspaper,
  Package,
  SearchX,
  Upload,
  UploadCloud,
} from 'lucide-react';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import SearchInput from '@/components/data/SearchInput';
import Pagination from '@/components/data/Pagination';
import MediaGrid from '@/components/media/MediaGrid';
import { MEDIA_DELETE_UNAVAILABLE } from '@/components/media/display';
import mediaStyles from '@/components/media/media.module.css';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import {
  getMediaStats,
  listMediaAssets,
  MEDIA_SORTS,
  MEDIA_SOURCE_FILTERS,
  MEDIA_UPLOAD_STATS_LIMIT,
  parseMediaSort,
  parseMediaSource,
  type MediaSort,
  type MediaSourceFilter,
} from '@/lib/data/media';
import { firstParam, pageCount } from '@/lib/pagination';
import MediaUploader from './uploader';

export const metadata: Metadata = { title: 'Media · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

const countFormat = new Intl.NumberFormat('en-IN');

/** Labels for the two filter selects, keyed by the data layer's own vocabularies. */
const SOURCE_LABELS: Record<MediaSourceFilter, string> = {
  all: 'All sources',
  product: 'Product images',
  article: 'Article covers',
  upload: 'Admin uploads',
};

const SORT_LABELS: Record<MediaSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  name: 'File name',
};

/**
 * Media library.
 *
 * The library is *derived*, not stored: there is no `media` table. The grid is
 * the union of product images, article covers, and the objects
 * `uploadMediaAction` wrote to R2 (recorded only in the audit log), merged and
 * paged by `listMediaAssets`. That union is why the page reads two things in
 * parallel — one window of assets, and the head-only counts behind the strip —
 * and why the "no results" case has to know whether the library is empty or the
 * filters are.
 *
 * Two numbers the brief asked for are not derivable, and the UI says so rather
 * than inventing them: total storage (no table stores a byte size; the object
 * sizes would need one R2 `ListObjectsV2` per prefix, which `lib/r2.ts` does not
 * expose) and a size sort (same reason). A tile's size is read with a single
 * best-effort `HEAD` in the lightbox.
 *
 * `/media` writes nothing: `src/server/actions/media.ts` only uploads, and the
 * delete affordance says so in the confirmation dialog (see `MediaGrid`).
 */
export default async function MediaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const resolved = (await searchParams) ?? {};
  const q = firstParam(resolved.q)?.trim() || undefined;
  const source = parseMediaSource(firstParam(resolved.source));
  const sort = parseMediaSort(firstParam(resolved.sort));
  const page = Number(firstParam(resolved.page)) || 1;

  // Only the non-default values travel in the URL, so a plain visit stays
  // `/media` and the pager keeps the filters it was used with.
  const params: Record<string, string | undefined> = {
    q,
    source: source === 'all' ? undefined : source,
    sort: sort === 'newest' ? undefined : sort,
  };

  const [assets, stats] = await Promise.all([
    listMediaAssets({ page, source, sort, q }),
    getMediaStats(),
  ]);

  const pages = pageCount(assets.count, assets.pageSize);

  return (
    <>
      <PageHeader
        icon={Images}
        title="Media"
        description="Every image and file the storefront serves."
        tone="rose"
        actions={
          <a className={`button ${mediaStyles.headerAction}`} href="#upload">
            <Upload size={14} aria-hidden="true" />
            Upload images
          </a>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Total assets"
          value={countFormat.format(stats.total)}
          icon={Images}
          tone="rose"
          hint="Images only — no video pipeline"
        />
        <StatCard
          label="Product images"
          value={countFormat.format(stats.productImages)}
          icon={Package}
          tone="indigo"
          hint="Catalogue photography"
        />
        <StatCard
          label="Article covers"
          value={countFormat.format(stats.articleImages)}
          icon={Newspaper}
          tone="amber"
          hint="Blog headers"
        />
        <StatCard
          label="Admin uploads"
          value={countFormat.format(stats.uploads)}
          icon={UploadCloud}
          tone="blue"
          hint={
            stats.uploadsTruncated
              ? `Newest ${MEDIA_UPLOAD_STATS_LIMIT} batches only`
              : `${countFormat.format(stats.uploadsLast30Days)} in the last 30 days`
          }
        />
        <StatCard
          label="Storage"
          value="Not tracked"
          icon={HardDrive}
          tone="slate"
          valueSm
          hint="No table stores a byte size"
        />
      </div>

      <div className="card" id="upload">
        <div className="card-header">
          <div>
            <div className="section-title">Upload</div>
            <div className="helper">
              Drop files or browse. Each image is converted to a WebP variant (max 1600px) in the
              browser before it is sent to the bucket.
            </div>
          </div>
        </div>
        <MediaUploader />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Library</div>
            <div className="helper">
              {countFormat.format(assets.count)} {assets.count === 1 ? 'asset' : 'assets'} · page{' '}
              {assets.page} of {pages}
              {assets.truncated
                ? ' · only the newest 500 are reachable — filter by source or search to narrow'
                : ''}
            </div>
          </div>
          <SearchInput placeholder="Search file name, alt text, or owner" delayMs={300} />
        </div>

        <FilterBar>
          {/* Keeps the search term when the selects are applied: `FilterBar`
              rebuilds the query string from the form. */}
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <FilterSelect
            name="source"
            label="Source"
            value={source}
            options={MEDIA_SOURCE_FILTERS.map((value) => ({
              value,
              label: SOURCE_LABELS[value],
            }))}
          />
          <FilterSelect
            name="sort"
            label="Sort"
            value={sort}
            options={MEDIA_SORTS.map((value) => ({ value, label: SORT_LABELS[value] }))}
          />
        </FilterBar>

        {assets.rows.length > 0 ? (
          <MediaGrid assets={assets.rows} />
        ) : stats.total === 0 ? (
          <EmptyState
            icon={<ImagePlus size={28} />}
            title="Nothing in the library yet"
            hint="Upload the first images above, or attach images from a product or article — every one of them lands here."
            actionLabel="Upload images"
            actionHref="#upload"
          />
        ) : (
          <EmptyState
            icon={<SearchX size={28} />}
            title="No assets match these filters"
            hint="Try a different file name, owner, or source. Sorting does not hide anything."
            actionLabel="Clear filters"
            actionHref="/media"
          />
        )}

        <Pagination
          basePath="/media"
          params={params}
          page={assets.page}
          pageSize={assets.pageSize}
          total={assets.count}
          shown={assets.rows.length}
          label="assets"
        />

        {assets.rows.length > 0 ? (
          <div className="helper" style={{ marginTop: 8 }}>
            {MEDIA_DELETE_UNAVAILABLE}
          </div>
        ) : null}
      </div>
    </>
  );
}
