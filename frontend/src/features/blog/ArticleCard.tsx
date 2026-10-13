import Image from 'next/image';
import Link from 'next/link';
import { cn, formatDate, stripHtml, truncate } from '@yord/ui';
import type { Article, ArticleWithBlog } from '@yord/db-types';

export interface ArticleCardProps {
  article: Article | ArticleWithBlog;
  priority?: boolean;
  className?: string;
}

/**
 * One card for every article surface. The blog index used to carry a private
 * copy of this component (tags, card frame, hover lift) while this one sat
 * unused, so the two drifted: only the copy had the card border, only this one
 * had the framer-motion entrance.
 *
 * It is a server component now: the `initial`/`animate`/`whileHover` triple
 * required `useState` and ignored `prefers-reduced-motion`. The lift is CSS
 * (`hover:-translate-y-1`), collapsed under `motion-reduce`, and keyboard focus
 * gets the same treatment through `group-focus-within`.
 */
export function ArticleCard({ article, priority = false, className }: ArticleCardProps) {
  const imageUrl = article.storage_image_url || article.image_src;
  const summary = article.summary_html ? truncate(stripHtml(article.summary_html), 150) : null;
  const tags = article.tags
    ? article.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return (
    <article className={cn('group', className)}>
      <Link
        href={`/blog/${article.handle}`}
        className="block bg-surface-card border border-border-default overflow-hidden transition-all duration-300 hover:border-border-strong hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 group-focus-within:border-border-strong"
      >
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-surface-raised">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={article.image_alt || article.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              priority={priority}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-text-muted text-sm">No Image</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-scrim/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none" />
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {article.author ? (
              <span className="text-accent font-accent tracking-wider uppercase text-xs">
                {article.author}
              </span>
            ) : null}
            {article.published_at ? (
              <span className="text-text-muted text-xs">{formatDate(article.published_at)}</span>
            ) : null}
          </div>

          {/* Title */}
          <h2 className="font-heading text-xl text-text-primary group-hover:text-accent group-focus-within:text-accent transition-colors line-clamp-2">
            {article.title}
          </h2>

          {/* Summary (plain text — no innerHTML needed) */}
          {summary ? <p className="text-text-muted text-sm line-clamp-3">{summary}</p> : null}

          {/* Tags */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-1 bg-surface-raised text-text-muted text-xs">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
