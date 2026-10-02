import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CollectionEditor from '@/components/collections/CollectionEditor';
import SmartRulesPanel from '@/components/collections/SmartRulesPanel';
import { getCollection } from '@/lib/data/collections';
import { formatDate } from '@/lib/utils/format';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCollection(Number(id)).catch(() => null);
  return { title: detail ? `${detail.collection.title} · YORD Admin` : 'Collection · YORD Admin' };
}

/**
 * Collection detail.
 *
 * The old `updateCollection` deleted every `collects` row and re-inserted the
 * products one at a time, `return`ing on the first insert error. A failure
 * halfway through left the collection holding a partial product set and showed
 * the admin nothing. The writes now run through the actions in
 * `src/server/actions/collections.ts`; the product replace is one transaction.
 */
export default async function CollectionDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const detail = await getCollection(numericId);
  if (!detail) notFound();

  const { collection, productIds, rules } = detail;

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Collection Detail</div>
            <div className="helper">
              {collection.collection_type} · updated {formatDate(collection.updated_at)}
            </div>
          </div>
          <Link className="button" href="/collections">
            Back
          </Link>
        </div>
        <CollectionEditor collection={collection} productIds={productIds} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Smart Rules</div>
            <div className="helper">Add rules to auto-curate products.</div>
          </div>
        </div>
        <SmartRulesPanel collectionId={collection.id} rules={rules} />
      </div>
    </div>
  );
}
