import 'server-only';

import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { reader, rows, runPage, runCount, uniqueIds, type Paged } from './client';

export interface ProductImageRow {
  id: number;
  product_id: number;
  storage_url: string | null;
  src: string | null;
  created_at: string | null;
}

/**
 * Recent product images, paged.
 *
 * Replaces `.limit(24)` with no pager: the media library showed the newest 24
 * images and there was no way to reach anything older.
 */
export async function listProductImages(filters: {
  page?: number;
  pageSize?: number;
}): Promise<Paged<ProductImageRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? 24;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);

  const request = supabase
    .from('product_images')
    .select('id, product_id, storage_url, src, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  return runPage<ProductImageRow>('product_images', request).then((result) => ({
    ...result,
    page,
    pageSize,
  }));
}

export interface ArticleImageRow {
  id: number;
  title: string;
  storage_image_url: string | null;
}

/** Recent article images, paged (was `.limit(12)`). */
export async function listArticleImages(filters: {
  page?: number;
  pageSize?: number;
}): Promise<Paged<ArticleImageRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? 12;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);

  const request = supabase
    .from('articles')
    .select('id, title, storage_image_url', { count: 'exact' })
    .not('storage_image_url', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  return runPage<ArticleImageRow>('articles', request).then((result) => ({
    ...result,
    page,
    pageSize,
  }));
}

// ─── Library view ─────────────────────────────────────────────────────────────
//
// The admin has no `media` table, so the library is *derived* from the three
// places an image can live:
//
//   1. `product_images`            — catalogue photography (storage_url, src)
//   2. `articles.storage_image_url` — blog covers
//   3. `admin_audit_log`           — what `uploadMediaAction` stored in R2
//
// (3) matters: an upload goes straight to R2 and records no row anywhere else,
// so without it an admin uploads ten files and they appear nowhere.
//
// The three sources are read as three time-ordered head windows and merged in
// memory, because their columns disagree (a product image carries `storage_url`
// *and* `src`, an article stores its cover in one column, an upload exists only
// inside an audit row's JSONB) and PostgREST cannot union them without a
// database view. For 2–3 sources the union's top-N is always contained in each
// source's own top-N, so pulling `page * pageSize` rows from each source and
// slicing the merged list is exact — that is what `depth` below is.
// `MEDIA_UNION_LIMIT` bounds the deepest page so the window cannot grow without
// limit.

/** Deepest window the merged view will page through. */
export const MEDIA_UNION_LIMIT = 500;

/** Tiles per page. 148px minimum tiles put 7–8 of these on a wide screen. */
export const MEDIA_PAGE_SIZE = 40;

/**
 * Upload batches read for the stat strip.
 *
 * `admin_audit_log` grows forever and one upload action writes one row for up
 * to ten assets, so both upload numbers come from the newest
 * `MEDIA_UPLOAD_STATS_LIMIT` batches. When the window is full the count is a
 * floor, which `MediaStats.uploadsTruncated` reports rather than hides.
 */
export const MEDIA_UPLOAD_STATS_LIMIT = 200;

export type MediaSource = 'product' | 'article' | 'upload';
export type MediaSourceFilter = MediaSource | 'all';
/** `size` is deliberately absent: no table stores byte size (see the page). */
export type MediaSort = 'newest' | 'oldest' | 'name';

export const MEDIA_SOURCE_FILTERS: readonly MediaSourceFilter[] = [
  'all',
  'product',
  'article',
  'upload',
];

export const MEDIA_SORTS: readonly MediaSort[] = ['newest', 'oldest', 'name'];

export function parseMediaSource(value: unknown): MediaSourceFilter {
  return typeof value === 'string' && (MEDIA_SOURCE_FILTERS as readonly string[]).includes(value)
    ? (value as MediaSourceFilter)
    : 'all';
}

export function parseMediaSort(value: unknown): MediaSort {
  return typeof value === 'string' && (MEDIA_SORTS as readonly string[]).includes(value)
    ? (value as MediaSort)
    : 'newest';
}

/** One tile: an image URL plus everything the grid and the lightbox show. */
export interface MediaAsset {
  /** Stable React key: `product:12`, `article:4`, `upload:<url path>`. */
  key: string;
  url: string;
  /** File name, derived from the URL — nothing stores one. */
  name: string;
  alt: string | null;
  source: MediaSource;
  /** Owning product/article id; null for a bare upload. */
  ownerId: number | null;
  /** "Product: Coldplay Tee" / the article title / "Admin upload". */
  ownerLabel: string;
  /** Admin route for the owner, when there is one. */
  ownerHref: string | null;
  createdAt: string | null;
  /** Stored dimensions. Null for uploads and for rows Shopify left blank. */
  width: number | null;
  height: number | null;
}

export interface MediaListFilters {
  page?: number;
  pageSize?: number;
  source?: MediaSourceFilter;
  sort?: MediaSort;
  q?: string;
}

export interface MediaPage extends Paged<MediaAsset> {
  /**
   * The three sources hold more than `MEDIA_UNION_LIMIT` assets, so the pager
   * cannot reach the very oldest. Surfaced so the page can say so instead of
   * quietly dropping rows.
   */
  truncated: boolean;
}

export interface MediaStats {
  total: number;
  productImages: number;
  articleImages: number;
  /** Assets uploaded through the admin uploader (from the audit log). */
  uploads: number;
  uploadsLast30Days: number;
  /** True when `uploads` hit the bounded read window and is a floor. */
  uploadsTruncated: boolean;
}

/** Last path segment of a URL, decoded — the closest thing to a file name. */
export function fileNameFromUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0];
  const segment = withoutQuery.split('/').filter(Boolean).pop();
  if (!segment) return url;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Public URLs recorded by `uploadMediaAction` in an audit row's `after`. */
export function uploadUrlsFromAudit(after: unknown): string[] {
  if (!after || typeof after !== 'object') return [];
  const value = (after as { urls?: unknown }).urls;
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

interface ProductAssetRow {
  id: number;
  product_id: number;
  storage_url: string | null;
  src: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  created_at: string | null;
}

interface ArticleAssetRow {
  id: number;
  title: string;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  storage_image_url: string;
  created_at: string | null;
}

interface UploadAuditRow {
  after: unknown;
  created_at: string | null;
}

/** Empty result for a source the current filter excludes. */
const NO_ROW = { rows: [] as MediaAsset[], count: 0 };

/**
 * List assets for the grid: filter by source, search, sort, page.
 *
 * Bounded: at most three head windows of `depth` rows (≤ 500) plus one product
 * title lookup for the rows actually on the page.
 */
export async function listMediaAssets(filters: MediaListFilters = {}): Promise<MediaPage> {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const source = filters.source ?? 'all';
  const sort = filters.sort ?? 'newest';
  const term = sanitizeSearch(filters.q);
  const depth = Math.min(page * pageSize, MEDIA_UNION_LIMIT);

  const [productPart, articlePart, uploadPart] = await Promise.all([
    source === 'all' || source === 'product' ? productAssetWindow(term, depth) : NO_ROW,
    source === 'all' || source === 'article' ? articleAssetWindow(term, depth) : NO_ROW,
    source === 'all' || source === 'upload' ? uploadAssetWindow(term, depth) : NO_ROW,
  ]);

  const total = productPart.count + articlePart.count + uploadPart.count;
  const count = Math.min(total, MEDIA_UNION_LIMIT);

  const merged = dedupeByUrl([...productPart.rows, ...articlePart.rows, ...uploadPart.rows]);
  sortAssets(merged, sort);

  const pageRows = merged.slice((page - 1) * pageSize, page * pageSize);
  await labelProductOwners(pageRows);

  return { rows: pageRows, count, page, pageSize, truncated: total > MEDIA_UNION_LIMIT };
}

/** Head window of `product_images`, newest first. */
async function productAssetWindow(
  term: string,
  depth: number,
): Promise<{ rows: MediaAsset[]; count: number }> {
  const supabase = await reader();
  const query = supabase
    .from('product_images')
    .select('id, product_id, storage_url, src, alt, width, height, created_at', {
      count: 'exact',
    });
  // `%`, `(`, `)`, `,` and `"` are PostgREST filter syntax; `_` and `*` are LIKE
  // wildcard aliases. `sanitizeSearch` strips both groups before they reach
  // `.or()`.
  const filtered = term
    ? query.or(
        `alt.ilike.%${term}%,src.ilike.%${term}%,storage_url.ilike.%${term}%`,
      )
    : query;
  const request = filtered
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, Math.max(0, depth - 1));

  const result = await runPage<ProductAssetRow>('product_images', request);
  const assets: MediaAsset[] = [];
  for (const row of result.rows) {
    const url = row.storage_url || row.src;
    if (!url) continue;
    assets.push({
      key: `product:${row.id}`,
      url,
      name: fileNameFromUrl(url),
      alt: row.alt,
      source: 'product',
      ownerId: row.product_id,
      ownerLabel: `Product #${row.product_id}`,
      ownerHref: `/products/${row.product_id}`,
      createdAt: row.created_at,
      width: row.width,
      height: row.height,
    });
  }
  return { rows: assets, count: result.count };
}

/** Head window of article covers, newest first. */
async function articleAssetWindow(
  term: string,
  depth: number,
): Promise<{ rows: MediaAsset[]; count: number }> {
  const supabase = await reader();
  const query = supabase
    .from('articles')
    .select(
      'id, title, image_alt, image_width, image_height, storage_image_url, created_at',
      { count: 'exact' },
    )
    .not('storage_image_url', 'is', null);
  const filtered = term
    ? query.or(`title.ilike.%${term}%,image_alt.ilike.%${term}%`)
    : query;
  const request = filtered
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, Math.max(0, depth - 1));

  const result = await runPage<ArticleAssetRow>('articles', request);
  const assets: MediaAsset[] = [];
  for (const row of result.rows) {
    const url = row.storage_image_url;
    if (!url) continue;
    assets.push({
      key: `article:${row.id}`,
      url,
      name: fileNameFromUrl(url),
      alt: row.image_alt,
      source: 'article',
      ownerId: row.id,
      ownerLabel: row.title,
      ownerHref: `/articles/${row.id}`,
      createdAt: row.created_at,
      width: row.image_width,
      height: row.image_height,
    });
  }
  return { rows: assets, count: result.count };
}

/**
 * Uploads recorded by `uploadMediaAction`, newest batch first.
 *
 * `admin_audit_log` is default-deny under RLS, so this read uses the service
 * client (same as `listAuditLog`). The window is bounded; a search term is
 * applied in memory because the URLs live inside JSONB and PostgREST cannot
 * filter on an array element.
 */
async function uploadAssetWindow(
  term: string,
  depth: number,
): Promise<{ rows: MediaAsset[]; count: number }> {
  const service = await reader({ service: true });
  const request = service
    .from('admin_audit_log')
    .select('after, created_at', { count: 'exact' })
    .eq('action', 'upload_media')
    .order('created_at', { ascending: false })
    .range(0, Math.max(0, depth - 1));

  const result = await runPage<UploadAuditRow>('admin_audit_log', request);
  const assets: MediaAsset[] = [];
  const seen = new Set<string>();
  for (const row of result.rows) {
    for (const url of uploadUrlsFromAudit(row.after)) {
      if (seen.has(url)) continue;
      seen.add(url);
      if (term && !url.toLowerCase().includes(term.toLowerCase())) continue;
      assets.push({
        key: `upload:${fileNameFromUrl(url)}`,
        url,
        name: fileNameFromUrl(url),
        alt: null,
        source: 'upload',
        ownerId: null,
        ownerLabel: 'Admin upload',
        ownerHref: null,
        createdAt: row.created_at,
        width: null,
        height: null,
      });
    }
  }
  // Counted in URLs, not audit rows: one batch row can carry ten uploads, and
  // the grid shows assets. This is exact for the window we pulled (and a floor
  // when the window was clipped, so the pager never offers an unreachable page).
  return { rows: assets, count: assets.length };
}

/** Same URL in two sources (an upload later attached to a product) shows once. */
const SOURCE_PRIORITY: Record<MediaSource, number> = { product: 0, article: 1, upload: 2 };

function dedupeByUrl(assets: MediaAsset[]): MediaAsset[] {
  if (assets.length < 2) return assets;
  assets.sort((a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]);
  const byUrl = new Map<string, MediaAsset>();
  for (const asset of assets) {
    const existing = byUrl.get(asset.url);
    // Keep the owned row; it carries the "used by" label the upload lacks.
    if (!existing) byUrl.set(asset.url, asset);
  }
  return [...byUrl.values()];
}

/** In-memory order over the merged window. Unknown dates always sort last. */
function sortAssets(assets: MediaAsset[], sort: MediaSort): void {
  if (sort === 'name') {
    assets.sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }) || a.key.localeCompare(b.key),
    );
    return;
  }
  const direction = sort === 'oldest' ? 1 : -1;
  assets.sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
    const bt = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
    const aMissing = Number.isNaN(at);
    const bMissing = Number.isNaN(bt);
    if (aMissing || bMissing) {
      if (aMissing && bMissing) return a.key.localeCompare(b.key);
      return aMissing ? 1 : -1;
    }
    if (at === bt) return a.key.localeCompare(b.key);
    return (at - bt) * direction;
  });
}

/**
 * Replace "Product #12" with the product's real title for the rows on screen.
 *
 * One query for at most `pageSize` ids, run after slicing so the `in (...)` list
 * never carries the whole window.
 */
async function labelProductOwners(assets: MediaAsset[]): Promise<void> {
  const ids = uniqueIds(
    assets.filter((asset) => asset.source === 'product').map((asset) => asset.ownerId),
  );
  if (ids.length === 0) return;

  const supabase = await reader();
  const titles = await rows<{ id: number; title: string }>(
    'products',
    supabase.from('products').select('id, title').in('id', ids),
  );
  const byId = new Map(titles.map((row) => [row.id, row.title]));
  for (const asset of assets) {
    if (asset.source !== 'product' || asset.ownerId === null) continue;
    const title = byId.get(asset.ownerId);
    if (title) asset.ownerLabel = title;
  }
}

/** 6–60 tiles per page; anything outside that makes the grid unreadable. */
function clampPageSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return MEDIA_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(parsed), 6), 60);
}

/**
 * Head-only counts behind the stat strip.
 *
 * Storage bytes are deliberately absent: no table stores a file size, and
 * reading it would mean one R2 request per asset (the S3 `ListObjectsV2` call
 * that returns sizes for a whole prefix is not implemented in `lib/r2.ts`).
 */
export async function getMediaStats(): Promise<MediaStats> {
  const supabase = await reader();
  const service = await reader({ service: true });

  const [productImages, articleImages, uploadRows] = await Promise.all([
    runCount(
      'product_images',
      supabase.from('product_images').select('id', { count: 'exact', head: true }),
    ),
    runCount(
      'articles',
      supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .not('storage_image_url', 'is', null),
    ),
    rows<UploadAuditRow>(
      'admin_audit_log',
      service
        .from('admin_audit_log')
        .select('after, created_at')
        .eq('action', 'upload_media')
        .order('created_at', { ascending: false })
        .limit(MEDIA_UPLOAD_STATS_LIMIT),
    ),
  ]);

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const urls = new Set<string>();
  let uploadsLast30Days = 0;
  for (const row of uploadRows) {
    const createdAt = row.created_at ? Date.parse(row.created_at) : Number.NaN;
    for (const url of uploadUrlsFromAudit(row.after)) {
      if (urls.has(url)) continue;
      urls.add(url);
      if (!Number.isNaN(createdAt) && createdAt >= cutoff) uploadsLast30Days += 1;
    }
  }

  return {
    total: productImages + articleImages + urls.size,
    productImages,
    articleImages,
    uploads: urls.size,
    uploadsLast30Days,
    uploadsTruncated: uploadRows.length >= MEDIA_UPLOAD_STATS_LIMIT,
  };
}
