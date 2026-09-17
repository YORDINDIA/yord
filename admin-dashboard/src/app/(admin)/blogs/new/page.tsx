import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createBlog(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const title = String(formData.get('title') || '').trim();
  if (!title) return;
  const handle = String(formData.get('handle') || '').trim();
  const tags = String(formData.get('tags') || '').trim();
  const id = await getNextId('blogs');
  const now = new Date().toISOString();
  const { error } = await supabase.from('blogs').insert({
    id,
    title,
    handle: handle || title.toLowerCase().replace(/\s+/g, '-'),
    tags: tags || null,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/blogs');
  redirect('/blogs');
}

export default function NewBlogPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Blog</div>
          <div className="helper">Create a new blog container.</div>
        </div>
        <Link className="button" href="/blogs">Back</Link>
      </div>
      <form action={createBlog} className="form-grid">
        <div>
          <label className="helper">Title</label>
          <input className="input" name="title" required />
        </div>
        <div>
          <label className="helper">Handle</label>
          <input className="input" name="handle" placeholder="auto-generated if empty" />
        </div>
        <div>
          <label className="helper">Tags</label>
          <input className="input" name="tags" />
        </div>
        <button className="button primary" type="submit">Create Blog</button>
      </form>
    </div>
  );
}
