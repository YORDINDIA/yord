'use client';

import { forwardRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn, formatDate } from '@/lib/utils';
import type { Article, ArticleWithBlog } from '@/types/database';

interface ArticleCardProps {
  article: Article | ArticleWithBlog;
  priority?: boolean;
  className?: string;
}

const ArticleCard = forwardRef<HTMLElement, ArticleCardProps>(
  ({ article, priority = false, className }, ref) => {
    const [isHovered, setIsHovered] = useState(false);

    const imageUrl = article.supabase_image_url || article.image_src;

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
          <div className="relative aspect-[16/9] overflow-hidden bg-noir-900 border border-noir-800 group-hover:border-noir-700 transition-colors">
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
              <div className="absolute inset-0 flex items-center justify-center bg-noir-800">
                <span className="text-ivory-400 text-sm">No Image</span>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-noir-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          {/* Content */}
          <div className="pt-4 space-y-2">
            {/* Meta */}
            <div className="flex items-center gap-2 text-sm">
              {article.author && (
                <span className="text-gold-200 font-[family-name:var(--font-bebas)] tracking-wider text-xs uppercase">
                  {article.author}
                </span>
              )}
              {article.published_at && (
                <>
                  <span className="text-ivory-500">•</span>
                  <span className="text-ivory-400 text-xs">
                    {formatDate(article.published_at)}
                  </span>
                </>
              )}
            </div>

            {/* Title */}
            <h3 className="font-[family-name:var(--font-cormorant)] text-lg text-ivory-50 group-hover:text-gold-200 transition-colors duration-300 line-clamp-2">
              {article.title}
            </h3>

            {/* Summary */}
            {article.summary_html && (
              <p
                className="text-ivory-300 text-sm line-clamp-2"
                dangerouslySetInnerHTML={{
                  __html: article.summary_html.replace(/<[^>]*>/g, '').slice(0, 120) + '...'
                }}
              />
            )}
          </div>
        </Link>
      </motion.article>
    );
  }
);

ArticleCard.displayName = 'ArticleCard';

export { ArticleCard };
