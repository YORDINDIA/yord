import Link from 'next/link';
import type { Metadata } from 'next';
import NewBlogForm from '@/components/blogs/NewBlogForm';

export const metadata: Metadata = { title: 'New Blog · YORD Admin' };

export default function NewBlogPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Blog</div>
          <div className="helper">Create a new blog container.</div>
        </div>
        <Link className="button" href="/blogs">
          Back
        </Link>
      </div>
      <NewBlogForm />
    </div>
  );
}
