import 'server-only';

import { cache } from 'react';
import type { Article, Blog } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { one, reader, rows, runPage, type Paged } from './client';

const BLOG_ENTITY = 'blogs';
const ARTICLE_ENTITY = 'articles';

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

export interface BlogDetail {
  blog: Blog;
  articles: ArticleListItem[];
}

/**
 * The only article fields the blog-detail page renders (ArticleList shows
 * id/title/published-state/dates). Selecting the full row pulled
 * body_html/summary_html per article for nothing.
 */
export type ArticleListItem = Pick<Article, 'id' | 'blog_id' | 'title' | 'published' | 'created_at'>;

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
      .select('id,blog_id,title,published,created_at')
      .eq('blog_id', id)
      .order('created_at', { ascending: false }),
  );
  return { blog, articles };
});

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
