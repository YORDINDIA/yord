export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';

export async function POST(req: Request) {
  try {
    const { topic, summary_html, body_html, tags, citations } = await req.json();
    const supabase = createServiceClient();
    const { data: blog } = await supabase.from('blogs').select('id').order('created_at', { ascending: true }).limit(1).single();
    if (!blog) {
      return NextResponse.json({ error: 'No blog available' }, { status: 400 });
    }

    const id = await getNextId('articles');
    const now = new Date().toISOString();
    const handle = (topic || 'ai-draft').toLowerCase().replace(/\s+/g, '-');
    const citationBlock = Array.isArray(citations) && citations.length
      ? `<h4>Citations</h4><ul>${citations.map((c: string) => `<li>${c}</li>`).join('')}</ul>`
      : '';
    const finalBody = `${body_html || ''}${citationBlock}`;

    await supabase.from('articles').insert({
      id,
      blog_id: blog.id,
      title: topic || 'AI Draft',
      handle,
      author: 'YORD Team',
      body_html: finalBody || null,
      summary_html: summary_html || null,
      tags: tags || null,
      published: false,
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
