import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getArticles } from '@/lib/supabase/queries';
import { formatDate, stripHtml } from '@yord/ui';
import type { ArticleWithBlog } from '@yord/db-types';

export const metadata: Metadata = {
  title: 'Blog — Concert Fashion, Style Guides & Music Stories',
  description: 'Stories, style guides, and behind-the-scenes from the world of premium concert fashion in India. Concert merch guides, artist features, and music culture.',
  openGraph: {
    title: 'Blog | YORD India',
    description: 'Stories, style guides, and behind-the-scenes from the world of premium concert fashion.',
    type: 'website',
  },
  alternates: { canonical: '/blog' },
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const rawPage = parseInt(params.page || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100) : 1;
  const pageSize = 12;

  const { data: articles, count } = await getArticles(page, pageSize);
  const totalPages = Math.ceil(count / pageSize);

  return (
    <main className="min-h-screen bg-surface-page pt-20">
      {/* Hero Section */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-accent mb-2 block">
          THE JOURNAL
        </span>
        <h1 className="font-[family-name:var(--font-playfair)] text-4xl lg:text-6xl text-text-primary mb-4">
          Stories & Style
        </h1>
        <p className="font-[family-name:var(--font-cormorant)] text-xl text-text-muted max-w-2xl">
          Behind-the-scenes, style guides, and stories from the world of premium concert fashion.
        </p>
      </section>

      {/* Articles Grid */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-24">
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg">No articles yet. Check back soon!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Blog pages" className="flex flex-wrap justify-center gap-2 mt-12">
                {page > 1 && (
                  <Link
                    href={`/blog?page=${page - 1}`}
                    className="px-4 h-10 flex items-center justify-center bg-surface-raised text-text-secondary hover:bg-surface-inset transition-colors font-[family-name:var(--font-bebas)] tracking-wider"
                  >
                    PREV
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/blog?page=${p}`}
                    aria-label={`Blog page ${p}`}
                    aria-current={p === page ? 'page' : undefined}
                    className={`w-10 h-10 flex items-center justify-center transition-colors ${
                      p === page
                        ? 'bg-accent text-text-on-accent'
                        : 'bg-surface-raised text-text-secondary hover:bg-surface-inset'
                    }`}
                  >
                    {p}
                  </Link>
                ))}
                {page < totalPages && (
                  <Link
                    href={`/blog?page=${page + 1}`}
                    className="px-4 h-10 flex items-center justify-center bg-surface-raised text-text-secondary hover:bg-surface-inset transition-colors font-[family-name:var(--font-bebas)] tracking-wider"
                  >
                    NEXT
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}

// Article Card Component
function ArticleCard({ article }: { article: ArticleWithBlog }) {
  const imageUrl = article.supabase_image_url || article.image_src;

  return (
    <Link href={`/blog/${article.handle}`} className="group block">
      <article className="bg-surface-card border border-border-default overflow-hidden transition-all duration-300 hover:border-border-strong hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-surface-raised">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={article.image_alt || article.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-text-muted text-sm">No Image</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-scrim/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* Meta */}
          <div className="flex items-center gap-3 text-sm">
            {article.author && (
              <span className="text-accent font-[family-name:var(--font-bebas)] tracking-wider uppercase text-xs">
                {article.author}
              </span>
            )}
            {article.published_at && (
              <span className="text-text-muted text-xs">
                {formatDate(article.published_at)}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="font-[family-name:var(--font-cormorant)] text-xl text-text-primary group-hover:text-accent transition-colors line-clamp-2">
            {article.title}
          </h2>

          {/* Summary (plain text — no innerHTML needed) */}
          {article.summary_html && (
            <p className="text-text-muted text-sm line-clamp-3">
              {stripHtml(article.summary_html).slice(0, 150) + '...'}
            </p>
          )}

          {/* Tags */}
          {article.tags && (
            <div className="flex flex-wrap gap-2 pt-2">
              {article.tags.split(',').slice(0, 3).map((tag) => (
                <span
                  key={tag.trim()}
                  className="px-2 py-1 bg-surface-raised text-text-muted text-xs"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
