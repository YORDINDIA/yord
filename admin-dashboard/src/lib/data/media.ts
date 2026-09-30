import 'server-only';

import { clampPage, pageRange } from '@/lib/pagination';
import { reader, runPage, type Paged } from './client';

export interface ProductImageRow {
  id: number;
  product_id: number;
  supabase_url: string | null;
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
    .select('id, product_id, supabase_url, src, created_at', { count: 'exact' })
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
  supabase_image_url: string | null;
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
    .select('id, title, supabase_image_url', { count: 'exact' })
    .not('supabase_image_url', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  return runPage<ArticleImageRow>('articles', request).then((result) => ({
    ...result,
    page,
    pageSize,
  }));
}
