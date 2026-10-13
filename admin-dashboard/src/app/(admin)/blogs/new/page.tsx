import Link from 'next/link';
import type { Metadata } from 'next';
import { BookPlus } from 'lucide-react';
import NewBlogForm from '@/components/blogs/NewBlogForm';
import PageHeader from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'New blog · YORD Admin' };

/**
 * Create-blog screen.
 *
 * The form is unchanged (`createBlogAction`, with the audit entry and the
 * generated handle); it now sits under the same `PageHeader` the rest of the
 * Content section uses, with the way back to the list.
 */
export default function NewBlogPage() {
  return (
    <>
      <PageHeader
        icon={BookPlus}
        title="New blog"
        description="A blog holds a set of articles."
        actions={
          <Link className="button" href="/blogs">
            Back to content
          </Link>
        }
      />

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blog details</div>
            <div className="helper">
              Title is required. The handle is generated from it when left empty.
            </div>
          </div>
        </div>
        <NewBlogForm />
      </div>
    </>
  );
}
