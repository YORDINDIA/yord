import MediaUploader from './uploader';
import { createServerClient } from '@/lib/supabase/server';

export default async function MediaPage() {
  const supabase = await createServerClient();
  const { data: productImages } = await supabase
    .from('product_images')
    .select('id, product_id, supabase_url, src')
    .order('created_at', { ascending: false })
    .limit(20);
  const { data: articleImages } = await supabase
    .from('articles')
    .select('id, title, supabase_image_url')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Media Library</div>
            <div className="helper">Upload new assets to Supabase Storage.</div>
          </div>
        </div>
        <MediaUploader />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Recent Product Images</div>
        </div>
        <div className="grid-2">
          {(productImages || []).map((img) => (
            <div key={img.id} className="card" style={{ padding: 12 }}>
              <div className="helper">Product #{img.product_id}</div>
              {img.supabase_url ? (
                <img src={img.supabase_url} alt="" style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
              ) : (
                <div className="helper">No Supabase URL</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Recent Article Images</div>
        </div>
        <div className="grid-2">
          {(articleImages || []).map((article) => (
            <div key={article.id} className="card" style={{ padding: 12 }}>
              <div className="helper">{article.title}</div>
              {article.supabase_image_url ? (
                <img src={article.supabase_image_url} alt="" style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
              ) : (
                <div className="helper">No Supabase image</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
