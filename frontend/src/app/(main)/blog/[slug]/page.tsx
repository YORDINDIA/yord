import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';
import { getArticleBySlug, getArticleBySlugStatic, getRelatedArticles, getArticlesStatic } from '@/lib/supabase/queries';
import { formatDate, stripHtml } from '@yord/ui';
import { sanitizeHtml } from '@/lib/sanitize';
import { estimateReadTime } from '@/lib/text';
import { JsonLd, articleSchema, breadcrumbSchema } from '@/lib/seo/jsonld';
import { ArticleCard } from '@/features/blog/ArticleCard';
import { Container } from '@/features/ui/Container';
import { SectionHeading } from '@/features/ui/SectionHeading';

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
    alternates: { canonical: `/blog/${slug}` },
  };
}

/**
 * Article body typography.
 *
 * The body used to carry `prose prose-invert prose-gold` — but
 * `@tailwindcss/typography` is not installed, so those classes compiled to
 * nothing and every migrated article rendered as unstyled browser HTML
 * (including `prose-invert`, which would have forced dark-theme colours on the
 * light default theme if it had worked). These are explicit utilities on the
 * tokens, and every one of them flips with the theme.
 */
const PROSE_CLASSES = [
  'font-body text-text-secondary leading-relaxed',
  // Measure: a 1440px column of 16px text is unreadable at ~110 characters.
  'max-w-3xl',
  '[&_h1]:font-display [&_h1]:text-3xl [&_h1]:text-text-primary [&_h1]:mt-10 [&_h1]:mb-4',
  '[&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-text-primary [&_h2]:mt-10 [&_h2]:mb-4',
  '[&_h3]:font-heading [&_h3]:text-xl [&_h3]:text-text-primary [&_h3]:mt-8 [&_h3]:mb-3',
  '[&_h4]:font-heading [&_h4]:text-lg [&_h4]:text-text-primary [&_h4]:mt-6 [&_h4]:mb-3',
  '[&_p]:mb-5',
  '[&_a]:text-accent [&_a]:underline hover:[&_a]:text-accent-hover',
  '[&_strong]:text-text-primary [&_strong]:font-semibold',
  '[&_em]:italic',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5',
  '[&_li]:mb-2',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-l-accent [&_blockquote]:pl-4 [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:text-text-muted',
  '[&_img]:w-full [&_img]:h-auto [&_img]:border [&_img]:border-border-default [&_img]:my-8',
  '[&_figure]:my-8 [&_figcaption]:text-xs [&_figcaption]:text-text-muted [&_figcaption]:mt-2',
  '[&_hr]:border-border-default [&_hr]:my-8',
  '[&_table]:w-full [&_table]:mb-6',
  '[&_th]:border [&_th]:border-border-default [&_th]:p-3 [&_th]:text-left [&_th]:text-text-primary',
  '[&_td]:border [&_td]:border-border-default [&_td]:p-3',
].join(' ');

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = await getRelatedArticles(article.id, 3);
  const imageUrl = article.storage_image_url || article.image_src;
  const readTime = estimateReadTime(article.body_html || '');
  const tags = article.tags
    ? article.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-surface-page pt-20">
      <JsonLd data={articleSchema(article)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: article.title, url: `/blog/${article.handle}` },
        ])}
      />

      {/* Back Navigation */}
      <Container className="py-6">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="font-accent tracking-wider text-sm">BACK TO BLOG</span>
        </Link>
      </Container>

      {/* Article Header + Body */}
      <article className="pb-24">
        <Container size="narrow">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-text-muted">
            {article.author ? (
              <div className="flex items-center gap-2">
                <User size={14} aria-hidden="true" />
                <span>{article.author}</span>
              </div>
            ) : null}
            {article.published_at ? (
              <div className="flex items-center gap-2">
                <Calendar size={14} aria-hidden="true" />
                <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Clock size={14} aria-hidden="true" />
              <span>{readTime} min read</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl lg:text-5xl text-text-primary mb-8 leading-tight">
            {article.title}
          </h1>

          {/* Featured Image */}
          {imageUrl ? (
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
          ) : null}

          {/* Article Body — sanitized at render as well as on save: stored HTML
              is the write-time guarantee, this is the read-time one. */}
          <div
            className={PROSE_CLASSES}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.body_html) }}
          />

          {/* Tags */}
          {tags.length > 0 ? (
            <div className="mt-12 pt-8 border-t border-border-default">
              <span className="font-accent text-xs tracking-wider text-text-muted mr-4">TAGS:</span>
              <div className="inline-flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-surface-raised text-text-muted text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Container>
      </article>

      {/* Related Articles */}
      {relatedArticles.length > 0 ? (
        <section className="bg-surface-card border-t border-border-default py-16">
          <Container>
            <SectionHeading title="Related Articles" className="mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedArticles.map((related) => (
                <ArticleCard key={related.id} article={related} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </div>
  );
}
