import type { Metadata } from 'next';
import Image from 'next/image';
import MediaUploader from './uploader';
import CopyUrlButton from '@/components/media/CopyUrlButton';
import Pagination from '@/components/data/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import { ImageOff } from 'lucide-react';
import { listArticleImages, listProductImages } from '@/lib/data/media';
import { firstParam, pageCount } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Media · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Media library.
 *
 * The two galleries were `.limit(24)` and `.limit(12)` with no pager, so older
 * media was unreachable. Both are paged now, and the previews render through
 * `next/image` with a real `alt` instead of `<img alt="">` behind an
 * eslint-disable.
 */
export default async function MediaPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  // Two paginated tables on one route, so two page params: sharing `page` meant
  // paging one grid moved the other too, and the two could never be on different
  // pages.
  const productPage = Number(firstParam(resolved?.product_page)) || 1;
  const articlePage = Number(firstParam(resolved?.article_page)) || 1;

  const [productImages, articleImages] = await Promise.all([
    listProductImages({ page: productPage }),
    listArticleImages({ page: articlePage }),
  ]);

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Media Library</div>
            <div className="helper">Drag and drop up to 10 images. URLs copy in one click.</div>
          </div>
        </div>
        <MediaUploader />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Product Images</div>
          <span className="helper">
            page {productImages.page} of {pageCount(productImages.count, productImages.pageSize)}
          </span>
        </div>
        {productImages.rows.length === 0 ? (
          <EmptyState
            title="No product images yet"
            hint="Upload images above, then attach them from a product's detail page."
            icon={<ImageOff size={28} />}
          />
        ) : (
          <div className="media-grid">
            {productImages.rows.map((img) => (
              <div key={img.id} className="card media-card" style={{ padding: 12 }}>
                <div className="helper">Product #{img.product_id}</div>
                {img.supabase_url ? (
                  <>
                    <Image
                      src={img.supabase_url}
                      alt={`Product ${img.product_id} image`}
                      width={320}
                      height={320}
                      sizes="(max-width: 768px) 50vw, 180px"
                      style={{ marginTop: 8, width: '100%', height: 'auto', borderRadius: 8 }}
                    />
                    <div className="toolbar" style={{ marginTop: 8 }}>
                      <CopyUrlButton url={img.supabase_url} />
                    </div>
                  </>
                ) : (
                  <div className="helper">No Supabase URL</div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination
          basePath="/media"
          params={articlePage > 1 ? { article_page: String(articlePage) } : {}}
          page={productImages.page}
          pageSize={productImages.pageSize}
          total={productImages.count}
          shown={productImages.rows.length}
          label="product images"
          pageParam="product_page"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Article Images</div>
          <span className="helper">
            page {articleImages.page} of {pageCount(articleImages.count, articleImages.pageSize)}
          </span>
        </div>
        {articleImages.rows.length === 0 ? (
          <EmptyState
            title="No article images"
            hint="Article covers migrated from Shopify appear here."
            icon={<ImageOff size={28} />}
          />
        ) : (
          <div className="media-grid">
            {articleImages.rows.map((article) => (
              <div key={article.id} className="card media-card" style={{ padding: 12 }}>
                <div className="helper">{article.title}</div>
                {article.supabase_image_url ? (
                  <>
                    <Image
                      src={article.supabase_image_url}
                      alt={`Cover image for ${article.title}`}
                      width={320}
                      height={320}
                      sizes="(max-width: 768px) 50vw, 180px"
                      style={{ marginTop: 8, width: '100%', height: 'auto', borderRadius: 8 }}
                    />
                    <div className="toolbar" style={{ marginTop: 8 }}>
                      <CopyUrlButton url={article.supabase_image_url} />
                    </div>
                  </>
                ) : (
                  <div className="helper">No Supabase image</div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination
          basePath="/media"
          params={productPage > 1 ? { product_page: String(productPage) } : {}}
          page={articleImages.page}
          pageSize={articleImages.pageSize}
          total={articleImages.count}
          shown={articleImages.rows.length}
          label="article images"
          pageParam="article_page"
        />
      </div>
    </div>
  );
}
