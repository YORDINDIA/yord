import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Calendar, User, Clock } from 'lucide-react';
import { getArticleBySlug, getArticleBySlugStatic, getRelatedArticles, getArticlesStatic } from '@/lib/supabase/queries';
import { formatDate, stripHtml } from '@yord/ui';
import { sanitizeHtml } from '@/lib/sanitize';
import { estimateReadTime } from '@/lib/text';
import { JsonLd, articleSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const articles = await getArticlesStatic();
  return articles
    .filter(article => article.handle)
    .map((article) => ({
      slug: article.handle!,
    }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlugStatic(slug);

  if (!article) {
    return {
      title: 'Article Not Found',
    };
  }

  const description = article.summary_html
    ? stripHtml(article.summary_html).slice(0, 160)
    : `Read ${article.title} on the YORD India blog.`;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      publishedTime: article.published_at || undefined,
      authors: article.author ? [article.author] : undefined,
      images: article.storage_image_url || article.image_src
        ? [{ url: article.storage_image_url || article.image_src! }]
        : undefined,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = await getRelatedArticles(article.id, 3);
  const imageUrl = article.storage_image_url || article.image_src;
  const readTime = estimateReadTime(article.body_html || '');

  return (
    <main className="min-h-screen bg-surface-page pt-20">
      <JsonLd data={articleSchema(article)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: article.title, url: `/blog/${article.handle}` },
        ])}
      />
      {/* Back Navigation */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-6">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="font-[family-name:var(--font-bebas)] tracking-wider text-sm">
            BACK TO BLOG
          </span>
        </Link>
      </div>

      {/* Article Header */}
      <article className="max-w-4xl mx-auto px-6 lg:px-12 pb-24">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-text-muted">
          {article.author && (
            <div className="flex items-center gap-2">
              <User size={14} />
              <span>{article.author}</span>
            </div>
          )}
          {article.published_at && (
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              <span>{formatDate(article.published_at)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span>{readTime} min read</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl lg:text-5xl text-text-primary mb-8 leading-tight">
          {article.title}
        </h1>

        {/* Featured Image */}
        {imageUrl && (
          <div className="relative aspect-[16/9] overflow-hidden bg-surface-card mb-12">
            <Image
              src={imageUrl}
              alt={article.image_alt || article.title}
              fill
              sizes="(max-width: 1024px) 100vw, 896px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Article Body */}
        <div
          className="prose prose-invert prose-gold max-w-none
            prose-headings:font-[family-name:var(--font-cormorant)]
            prose-headings:text-text-primary
            prose-p:font-[family-name:var(--font-jakarta)]
            prose-p:text-text-secondary
            prose-p:leading-relaxed
            prose-a:text-accent
            prose-a:no-underline
            hover:prose-a:underline
            prose-strong:text-text-primary
            prose-blockquote:border-l-accent
            prose-blockquote:text-text-muted
            prose-blockquote:italic
            prose-img:rounded-none
            prose-img:border
            prose-img:border-border-default
            prose-li:text-text-secondary"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.body_html) }}
        />

        {/* Tags */}
        {article.tags && (
          <div className="mt-12 pt-8 border-t border-border-default">
            <span className="font-[family-name:var(--font-bebas)] text-xs tracking-wider text-text-muted mr-4">
              TAGS:
            </span>
            <div className="inline-flex flex-wrap gap-2">
              {article.tags.split(',').map((tag) => (
                <span
                  key={tag.trim()}
                  className="px-3 py-1 bg-surface-raised text-text-muted text-sm"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <section className="bg-surface-card border-t border-border-default py-16">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-8">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/blog/${related.handle}`}
                  className="group"
                >
                  <article className="space-y-3">
                    {(related.storage_image_url || related.image_src) && (
                      <div className="relative aspect-[16/9] overflow-hidden bg-surface-raised">
                        <Image
                          src={related.storage_image_url || related.image_src!}
                          alt={related.image_alt || related.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <h3 className="font-[family-name:var(--font-cormorant)] text-lg text-text-secondary group-hover:text-accent transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    {related.published_at && (
                      <p className="text-text-muted text-xs">
                        {formatDate(related.published_at)}
                      </p>
                    )}
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
