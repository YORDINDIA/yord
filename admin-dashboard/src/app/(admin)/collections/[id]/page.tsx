import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, ExternalLink, FolderKanban, Plus } from 'lucide-react';
import CollectionDeleteButton from '@/components/collections/CollectionDeleteButton';
import CollectionEditor from '@/components/collections/CollectionEditor';
import SmartRulesPanel from '@/components/collections/SmartRulesPanel';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Thumb from '@/components/ui/Thumb';
import { displayableCoverUrl } from '@/lib/collection-list';
import { getCollection } from '@/lib/data/collections';
import { listMediaAssets } from '@/lib/data/media';
import { listProductPickerRows } from '@/lib/data/products';
import { isAutoCollectionHandle } from '@/lib/constants';
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
 *
 * Layout: `PageHeader` for identity, status badges and actions, then
 * `.layout-split` — the editor (plus, for smart collections, the rules panel)
 * in the main column and a sticky rail holding the storefront preview, the
 * row's meta, and — for non-auto collections — the delete control.
 */
export default async function CollectionDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const detail = await getCollection(numericId);
  if (!detail) notFound();

  const { collection, productIds, rules } = detail;
  // The cover picker's media window is a read like any other, so it runs
  // alongside the member read instead of serialising behind it.
  const [products, media] = await Promise.all([
    listProductPickerRows(productIds),
    listMediaAssets({ page: 1, pageSize: 60 }),
  ]);
  const isAuto = isAutoCollectionHandle(collection.handle);
  // The storefront renders active products only, so a collection can hold
  // members and still show an empty page; the rail says so rather than letting
  // "published with products" look like it must be live.
  const activeCount = products.filter((product) => product.status === 'active').length;
  const productCount = productIds.length;
  const cover = displayableCoverUrl(collection.storage_image_url, collection.image_src);
  // The storefront gates /collection/<handle> on the row (published + handle),
  // so the external link exists only when both hold.
  const storefrontHref =
    collection.published && collection.handle
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/collection/${collection.handle}`
      : null;

  return (
    <>
      <PageHeader
        icon={FolderKanban}
        title={collection.title}
        description={`${collection.collection_type} · ${productCount} product${productCount === 1 ? '' : 's'} · updated ${formatDate(collection.updated_at)}`}
        actions={
          <>
            <StatusBadge value={collection.published ? 'published' : 'draft'} size="md" />
            <StatusBadge
              value={collection.collection_type}
              label={collection.collection_type === 'smart' ? 'Smart' : 'Custom'}
              tone={collection.collection_type === 'smart' ? 'info' : 'neutral'}
              size="md"
            />
            {isAuto && <StatusBadge value="auto" tone="info" label="Auto" size="md" />}
            {storefrontHref && (
              <a className="button" href={storefrontHref} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden />
                View on storefront
              </a>
            )}
            <Link className="button" href="/collections/new">
              <Plus size={14} aria-hidden />
              New collection
            </Link>
            <Link className="button" href="/collections">
              <ArrowLeft size={14} aria-hidden />
              Back to collections
            </Link>
          </>
        }
      />

      <div className="layout-split">
        <div className="stack">
          <section className="card">
            <div className="card-header">
              <div className="section-title">Collection</div>
              <span className="helper">Title, handle, type, cover, and description.</span>
            </div>
            <CollectionEditor
              collection={collection}
              productIds={productIds}
              products={products}
              memberCount={productCount}
              activeCount={activeCount}
              assets={media.rows}
            />
          </section>

          {!isAuto && (
            <section className="card">
              <div className="card-header">
                <div className="section-title">Smart Rules</div>
                <span className="helper">
                  Rules that auto-curate products. Preview what they match, then apply.
                </span>
              </div>
              <SmartRulesPanel
                collectionId={collection.id}
                rules={rules}
                collectionType={collection.collection_type}
              />
            </section>
          )}
        </div>

        <aside className="side-rail">
          <section className="card">
            <div className="card-header">
              <div className="section-title">Storefront preview</div>
            </div>
            <div className="stack-sm">
              <Thumb src={cover} alt={collection.title} size="xl" />
              <span className="strong truncate">{collection.title}</span>
              {collection.handle ? (
                storefrontHref ? (
                  <a className="helper" href={storefrontHref} target="_blank" rel="noreferrer">
                    /collection/{collection.handle}
                  </a>
                ) : (
                  <span className="helper mono">/collection/{collection.handle}</span>
                )
              ) : (
                <span className="helper">No handle yet — save one to get a storefront page.</span>
              )}
              <span className="helper">
                {productCount} product{productCount === 1 ? '' : 's'} · {activeCount} active
              </span>
              {collection.published && activeCount === 0 && (
                <div
                  className="form-alert form-alert-error tone-rose"
                  role="status"
                  style={{ marginBottom: 0 }}
                >
                  <AlertTriangle size={15} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
                  <span>
                    Published, but the storefront shows active products only — this page renders
                    empty.
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="section-title">Details</div>
            </div>
            <div className="stack-sm">
              <MetaRow label="ID">#{collection.id}</MetaRow>
              <MetaRow label="Type">{collection.collection_type}</MetaRow>
              <MetaRow label="Default sort">{collection.sort_order || 'Newest first'}</MetaRow>
              <MetaRow label="Published">{formatDate(collection.published_at)}</MetaRow>
              <MetaRow label="Updated">{formatDate(collection.updated_at)}</MetaRow>
            </div>
            {isAuto && (
              <>
                <hr className="hr" />
                <div className="helper">
                  Auto collection: the storefront computes this page&apos;s membership and publication
                  state, so the editor&apos;s product list and published box are read-only.
                </div>
              </>
            )}
          </section>

          {!isAuto && (
            <section className="card">
              <div className="card-header">
                <div className="section-title">Danger zone</div>
              </div>
              <div className="stack-sm">
                <span className="helper">
                  Deleting removes the collection, its memberships and its rules — the storefront
                  page goes away with it.
                </span>
                <CollectionDeleteButton
                  collectionId={collection.id}
                  title={collection.title}
                  handle={collection.handle}
                />
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

/** Label/value line for the details rail (global `.meta-row` pattern). */
function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="meta-row row-between">
      <span className="helper">{label}</span>
      <span className="strong">
        <span className="mono">{children}</span>
      </span>
    </div>
  );
}
