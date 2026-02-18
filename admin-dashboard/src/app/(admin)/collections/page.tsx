import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/format';

export default async function CollectionsPage() {
  const supabase = await createServerClient();
  const { data: collections } = await supabase
    .from('collections')
    .select('id, title, collection_type, published, updated_at, collects(count)')
    .order('updated_at', { ascending: false })
    .limit(100);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Collections</div>
          <div className="helper">Custom and smart merchandising groups.</div>
        </div>
        <Link className="button primary" href="/collections/new">New Collection</Link>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Products</th>
            <th>Published</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {(collections || []).map((collection) => (
            <tr key={collection.id}>
              <td><Link href={`/collections/${collection.id}`}>{collection.title}</Link></td>
              <td>{collection.collection_type}</td>
              <td>{collection.collects?.[0]?.count ?? 0}</td>
              <td>{collection.published ? 'Yes' : 'No'}</td>
              <td>{formatDate(collection.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
