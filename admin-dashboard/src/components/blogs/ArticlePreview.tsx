'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { CalendarDays, Clock, ImageIcon } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils/format';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { articlePath, stripTags, textMetrics } from './display';
import styles from './blogs.module.css';

/**
 * Live storefront preview for the article editor.
 *
 * Two things are deliberate:
 *
 * - The body is sanitized *here*, in the component that writes it with
 *   `dangerouslySetInnerHTML`, not only on the way to the database. The write
 *   action sanitizes too, but a preview is an execution surface on the admin
 *   origin the moment it renders attacker- or model-authored HTML, and a
 *   caller could hand this component raw markup.
 * - The sanitized string is computed during render, so there is no frame where
 *   unsanitized HTML is mounted.
 *
 * The caller passes the already-debounced body, so typing re-renders this at
 * most every ~300ms.
 */
export default function ArticlePreview({
  title,
  handle,
  excerpt,
  bodyHtml,
  coverUrl,
  published,
  publishedAt,
}: {
  title: string;
  handle: string;
  /** Raw excerpt HTML; rendered as plain text. */
  excerpt: string;
  /** Raw body HTML — sanitized on render below. */
  bodyHtml: string;
  coverUrl: string | null;
  published: boolean;
  publishedAt: string | null;
}) {
  const safeBody = useMemo(() => sanitizeHtml(bodyHtml), [bodyHtml]);
  const metrics = useMemo(() => textMetrics(safeBody), [safeBody]);
  const excerptText = stripTags(excerpt);
  const shownExcerpt = excerptText.length > 220 ? `${excerptText.slice(0, 220)}…` : excerptText;
  const path = articlePath(handle);

  return (
    <div className="stack-sm">
      <div className={styles.previewFrame}>
        {coverUrl ? (
          <Image src={coverUrl} alt="" fill sizes="320px" />
        ) : (
          <ImageIcon size={22} aria-hidden />
        )}
      </div>

      <div className={styles.previewMeta}>
        <StatusBadge value={published ? 'published' : 'draft'} dot />
        <span className={styles.previewMetaItem}>
          <CalendarDays size={12} aria-hidden />
          {published && publishedAt
            ? `Published ${formatDate(publishedAt)}`
            : published
              ? 'Publishing now'
              : 'Draft — not on the storefront'}
        </span>
        <span className={styles.previewMetaItem}>
          <Clock size={12} aria-hidden />
          {metrics.minutes > 0 ? `${metrics.minutes} min read` : '—'}
        </span>
        <span className={`${styles.previewMetaItem} mono`} title="Storefront path">
          {path ?? 'no handle yet'}
        </span>
      </div>

      <h2 className={styles.previewTitle}>{title.trim() || 'Untitled article'}</h2>
      {shownExcerpt && <p className={styles.previewExcerpt}>{shownExcerpt}</p>}

      <div className={styles.previewRule} aria-hidden />

      {safeBody ? (
        // `prose-admin` is the rendered-HTML container from globals.css.
        <div className={`prose-admin ${styles.previewBody}`} dangerouslySetInnerHTML={{ __html: safeBody }} />
      ) : (
        <p className={styles.previewEmpty}>The body is empty. Type in “Body HTML” and it renders here.</p>
      )}

      <p className="helper">
        Scripts, embedded frames, event-handler attributes, and `javascript:` URLs are stripped on
        render, exactly as the storefront will receive them.
      </p>
    </div>
  );
}
