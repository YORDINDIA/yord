import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import NewCollectionForm from '@/components/collections/NewCollectionForm';
import PageHeader from '@/components/ui/PageHeader';
import { SECTIONS } from '@/lib/sections';
import { listMediaAssets } from '@/lib/data/media';

export const metadata: Metadata = { title: 'New Collection · YORD Admin' };

/**
 * New-collection route. Thin by design: the header is chrome, every field and
 * every write lives in `NewCollectionForm` → `createCollectionAction`.
 *
 * The page fetches one bounded window of recent media-library assets so the
 * cover picker (`CoverField`) can offer "Choose from library" without a new
 * API route or middleware change — the same server-provided window the editor
 * uses. A failed read throws into the nearest `error.tsx` (the error model:
 * only *empty* ever degrades to `[]`).
 */
export default async function NewCollectionPage() {
  const media = await listMediaAssets({ page: 1, pageSize: 60 });

  return (
    <>
      <PageHeader
        icon={FolderPlus}
        title="New collection"
        description={SECTIONS.collections.description}
        actions={
          <Link className="button" href="/collections">
            <ArrowLeft size={13} aria-hidden />
            Back to collections
          </Link>
        }
      />
      <div className="card">
        <NewCollectionForm assets={media.rows} />
      </div>
    </>
  );
}
