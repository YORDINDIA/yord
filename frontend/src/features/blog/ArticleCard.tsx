'use client';

import { forwardRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn, formatDate, stripHtml } from '@yord/ui';
import type { Article, ArticleWithBlog } from '@yord/db-types';

interface ArticleCardProps {
  article: Article | ArticleWithBlog;
  priority?: boolean;
  className?: string;
}

const ArticleCard = forwardRef<HTMLElement, ArticleCardProps>(
  ({ article, priority = false, className }, ref) => {
    const [isHovered, setIsHovered] = useState(false);

    const imageUrl = article.storage_image_url || article.image_src;

    return (
      <motion.article
        ref={ref}
        className={cn('group relative', className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        whileHover={{ y: -4 }}
      >
        <Link href={`/blog/${article.handle}`} className="block">
          {/* Image */}
          <div className="relative aspect-[16/9] overflow-hidden bg-surface-card border border-border-default group-hover:border-accent/50 transition-colors">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={article.image_alt || article.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className={cn(
                  'object-cover transition-all duration-500',
                  isHovered ? 'scale-105' : 'scale-100'
                )}
                priority={priority}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
                <span className="text-text-muted text-sm">No Image</span>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-scrim/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          {/* Content */}
          <div className="pt-4 space-y-2">
            {/* Meta */}
            <div className="flex items-center gap-2 text-sm">
              {article.author && (
                <span className="text-accent font-[family-name:var(--font-bebas)] tracking-wider text-xs uppercase">
                  {article.author}
                </span>
              )}
              {article.published_at && (
                <>
                  <span className="text-text-muted">•</span>
                  <span className="text-text-muted text-xs">
                    {formatDate(article.published_at)}
                  </span>
                </>
              )}
            </div>

            {/* Title */}
            <h3 className="font-[family-name:var(--font-cormorant)] text-lg text-text-primary group-hover:text-accent transition-colors duration-300 line-clamp-2">
              {article.title}
            </h3>

            {/* Summary (plain text — no innerHTML needed) */}
            {article.summary_html && (
              <p className="text-text-muted text-sm line-clamp-2">
                {stripHtml(article.summary_html).slice(0, 120) + '...'}
              </p>
            )}
          </div>
        </Link>
      </motion.article>
    );
  }
);

ArticleCard.displayName = 'ArticleCard';

export { ArticleCard };
