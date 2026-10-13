import { Metadata } from 'next';
import Link from 'next/link';
import { getArticles } from '@/lib/supabase/queries';
import { ArticleCard } from '@/features/blog/ArticleCard';
import { Container } from '@/features/ui/Container';
import { EmptyState } from '@/features/ui/EmptyState';
import { SectionHeading } from '@/features/ui/SectionHeading';

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
    <div className="min-h-screen bg-surface-page pt-20">
      {/* Hero Section */}
      <section className="py-16">
        <Container>
          <SectionHeading
            as="h1"
            eyebrow="THE JOURNAL"
            title="Stories & Style"
            description="Behind-the-scenes, style guides, and stories from the world of premium concert fashion."
          />
        </Container>
      </section>

      {/* Articles Grid */}
      <section className="pb-24">
        <Container>
          {articles.length === 0 ? (
            <EmptyState
              title="No articles yet"
              message="The journal is being written. Check back soon, or browse the catalogue in the meantime."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.map((article, index) => (
                  <ArticleCard key={article.id} article={article} priority={index < 3} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav aria-label="Blog pages" className="flex flex-wrap justify-center gap-2 mt-12">
                  {page > 1 && (
                    <Link
                      href={`/blog?page=${page - 1}`}
                      className="px-4 h-10 flex items-center justify-center bg-surface-raised text-text-secondary hover:bg-surface-inset transition-colors font-accent tracking-wider"
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
                      className="px-4 h-10 flex items-center justify-center bg-surface-raised text-text-secondary hover:bg-surface-inset transition-colors font-accent tracking-wider"
                    >
                      NEXT
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </Container>
      </section>
    </div>
  );
}
