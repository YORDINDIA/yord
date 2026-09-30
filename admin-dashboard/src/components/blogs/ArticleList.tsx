import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils/format';
import type { Article } from '@yord/db-types';

/**
 * Article list for one blog.
 *
 * Was a `<ul>` of raw titles; the published/draft state is now a badge so an
 * admin can see at a glance what is live.
 */
export default function ArticleList({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return <p className="helper">No articles in this blog yet.</p>;
  }
  return (
    <ul className="helper" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
      {articles.map((article) => (
        <li key={article.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href={`/articles/${article.id}`}>{article.title}</Link>
          <StatusBadge value={article.published ? 'published' : 'draft'} />
          <span>{formatDate(article.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
