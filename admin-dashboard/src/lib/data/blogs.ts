import 'server-only';

import { cache } from 'react';
import type { Article, Blog } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { one, reader, rows, runCount, runPage, type Paged } from './client';

const BLOG_ENTITY = 'blogs';
const ARTICLE_ENTITY = 'articles';

/**
 * The article columns both list tables render. Spelled out instead of `*`
 * because `select('*')` pulls `body_html`/`summary_html` (up to 200 kB each)
 * for every row of a 25-row page to display a title, an author, and a thumb.
 */
const ARTICLE_LIST_COLUMNS =
  'id,blog_id,title,handle,author,published,published_at,created_at,updated_at,image_src,storage_image_url';

/** Publish state, as the article filter and the list pages use it. */
export type ArticleStatus = 'published' | 'draft';

/** Narrow a raw `?article_status=` query value to a filter, or `undefined`. */
export function parseArticleStatus(value: string | undefined | null): ArticleStatus | undefined {
  return value === 'published' || value === 'draft' ? value : undefined;
}

/**
 * Blog containers and their articles, both paged.
 *
 * The blog list was unbounded and the article list was capped at 10 with no
 * pager, so articles past the tenth were unreachable from /blogs.
 */
export async function listBlogs(filters: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paged<Blog>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);

  let request = supabase
    .from('blogs')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (search) request = request.or(`title.ilike.%${search}%,handle.ilike.%${search}%`);

  const result = await runPage<Blog>(BLOG_ENTITY, request);
  return { ...result, page, pageSize };
}

/**
 * What the blog list needs beyond the `blogs` row: how much is inside each
 * blog, whether any of it is live, and something to show as a cover.
 *
 * A blog has no image and no status column of its own (see the `Blog` type —
 * `commentable`/`feedburner`/`template_suffix` are the only extras), so both
 * marks are derived from the blog's articles: the cover is the newest article
 * image, the state is whether any article is published.
 */
export interface BlogListMeta {
  articleCount: number;
  publishedCount: number;
  /** Newest article image, or null when the blog has no article with one. */
  coverUrl: string | null;
  /** Newest article `updated_at`, or null when the blog is empty. */
  lastUpdatedAt: string | null;
}

export type BlogListRow = Blog & { meta: BlogListMeta };

/**
 * Ceiling on the article rows one page of blogs scans to derive those counts.
 * One query covers every blog on the page (25 blogs is `in (…)` on one
 * request), so a page of blogs costs two reads total instead of 25 counts.
 * A page of blogs holding more than this many articles would under-count; at
 * that size the numbers come from the articles table anyway, which pages.
 */
const BLOG_PAGE_ARTICLE_SCAN = 4000;

function emptyBlogMeta(): BlogListMeta {
  return { articleCount: 0, publishedCount: 0, coverUrl: null, lastUpdatedAt: null };
}

/**
 * Blog list plus the per-blog counts/cover the table renders.
 *
 * `listBlogs` stays as it was — this wraps it and hydrates the page's rows in
 * one extra bounded read, the same batch-read shape `listOrders` uses.
 */
export async function listBlogsWithMeta(filters: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paged<BlogListRow>> {
  const page = await listBlogs(filters);
  if (page.rows.length === 0) return { ...page, rows: [] };

  const supabase = await reader();
  const ids = page.rows.map((blog) => blog.id);
  const articles = await rows<
    Pick<
      Article,
      'blog_id' | 'published' | 'updated_at' | 'image_src' | 'storage_image_url'
    >
  >(
    ARTICLE_ENTITY,
    supabase
      .from('articles')
      .select('blog_id,published,updated_at,image_src,storage_image_url')
      .in('blog_id', ids)
      // Newest first, so the first image found per blog is its cover.
      .order('created_at', { ascending: false })
      .range(0, BLOG_PAGE_ARTICLE_SCAN - 1),
  );

  const meta = new Map<number, BlogListMeta>(
    ids.map((id): [number, BlogListMeta] => [id, emptyBlogMeta()]),
  );
  for (const article of articles) {
    const entry = meta.get(article.blog_id);
    if (!entry) continue;
    entry.articleCount += 1;
    if (article.published) entry.publishedCount += 1;
    if (!entry.coverUrl) entry.coverUrl = article.storage_image_url || article.image_src || null;
    if (!entry.lastUpdatedAt || (article.updated_at ?? '') > entry.lastUpdatedAt) {
      entry.lastUpdatedAt = article.updated_at ?? entry.lastUpdatedAt;
    }
  }

  return {
    ...page,
    rows: page.rows.map((blog) => ({ ...blog, meta: meta.get(blog.id) ?? emptyBlogMeta() })),
  };
}

export async function listArticles(filters: {
  blogId?: number;
  page?: number;
  pageSize?: number;
}): Promise<Paged<Article>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);

  let request = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (filters.blogId) request = request.eq('blog_id', filters.blogId);

  const result = await runPage<Article>(ARTICLE_ENTITY, request);
  return { ...result, page, pageSize };
}

/**
 * Paged article list for the Content page's second table, with optional
 * per-blog and publish-state filters (`?blog=` / `?article_status=`).
 *
 * Separate from `listArticles` (which stays as it was for its existing
 * callers) because this one selects the list columns only, so the table does
 * not drag every article body across the wire.
 */
export async function listArticleRows(filters: {
  blogId?: number;
  status?: ArticleStatus;
  page?: number;
  pageSize?: number;
}): Promise<Paged<ArticleListItem>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);

  let request = supabase
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (filters.blogId) request = request.eq('blog_id', filters.blogId);
  if (filters.status) request = request.eq('published', filters.status === 'published');

  const result = await runPage<ArticleListItem>(ARTICLE_ENTITY, request);
  return { ...result, page, pageSize };
}

export interface BlogDetail {
  blog: Blog;
  articles: ArticleListItem[];
}

/**
 * The article fields the two list tables render (blog detail and the Content
 * page's article table).
 *
 * Wider than the original `id/title/published/created_at` pick so a row can
 * lead with a cover thumb and show an author, a slug, and a publish date
 * without a second read per row. Every previously used field is still here, so
 * existing callers are unaffected.
 */
export type ArticleListItem = Pick<
  Article,
  | 'id'
  | 'blog_id'
  | 'title'
  | 'handle'
  | 'author'
  | 'published'
  | 'published_at'
  | 'created_at'
  | 'updated_at'
  | 'image_src'
  | 'storage_image_url'
>;

/** One blog with its articles (unpaged: a blog's own article list). */
export const getBlog = cache(async (id: number): Promise<BlogDetail | null> => {
  const supabase = await reader();
  const blog = await one<Blog>(
    BLOG_ENTITY,
    supabase.from('blogs').select('*').eq('id', id).limit(1).maybeSingle(),
  );
  if (!blog) return null;

  const articles = await rows<ArticleListItem>(
    ARTICLE_ENTITY,
    supabase
      .from('articles')
      .select(ARTICLE_LIST_COLUMNS)
      .eq('blog_id', id)
      .order('created_at', { ascending: false }),
  );
  return { blog, articles };
});

/**
 * One blog's identity, for labelling an `?blog=` filter. `getBlog` would pull
 * the blog's whole article list to render a chip.
 */
export const getBlogRef = cache(
  async (id: number): Promise<Pick<Blog, 'id' | 'title' | 'handle'> | null> => {
    const supabase = await reader();
    return one<Pick<Blog, 'id' | 'title' | 'handle'>>(
      BLOG_ENTITY,
      supabase.from('blogs').select('id,title,handle').eq('id', id).limit(1).maybeSingle(),
    );
  },
);

/** One article. `null` when the id does not exist. */
export const getArticle = cache(async (id: number): Promise<Article | null> => {
  const supabase = await reader();
  return one<Article>(
    ARTICLE_ENTITY,
    supabase.from('articles').select('*').eq('id', id).limit(1).maybeSingle(),
  );
});

/**
 * The first blog by creation order, used as the parent for AI-generated drafts
 * (the AI save route used to pick this row the same way).
 */
export async function getFirstBlogId(): Promise<number | null> {
  const supabase = await reader();
  const result = await rows<Pick<Blog, 'id'>>(
    BLOG_ENTITY,
    supabase.from('blogs').select('id').order('created_at', { ascending: true }).limit(1),
  );
  return result[0]?.id ?? null;
}

/** Everything the Content page's stat strip shows, in one payload. */
export interface ContentSummary {
  blogs: number;
  articles: number;
  published: number;
  drafts: number;
  /** Newest article `updated_at`, or null when there are no articles. */
  lastUpdatedAt: string | null;
}

/**
 * Content counts for the stat strip.
 *
 * Three head-only counts plus one 1-row read, in parallel — one payload rather
 * than a query per tile (the same shape `orderSummary()` uses). No per-row
 * reads, so the cost does not move as the catalogue grows; `drafts` is derived
 * from the two totals instead of a fourth count.
 */
export async function contentSummary(): Promise<ContentSummary> {
  const supabase = await reader();

  const [blogs, articles, published, latest] = await Promise.all([
    runCount(BLOG_ENTITY, supabase.from('blogs').select('id', { count: 'exact', head: true })),
    runCount(ARTICLE_ENTITY, supabase.from('articles').select('id', { count: 'exact', head: true })),
    runCount(
      ARTICLE_ENTITY,
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('published', true),
    ),
    rows<Pick<Article, 'updated_at'>>(
      ARTICLE_ENTITY,
      supabase
        .from('articles')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1),
    ),
  ]);

  return {
    blogs,
    articles,
    published,
    drafts: Math.max(0, articles - published),
    lastUpdatedAt: latest[0]?.updated_at ?? null,
  };
}
