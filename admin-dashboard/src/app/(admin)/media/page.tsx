import MediaUploader from './uploader';
import CopyUrlButton from '@/components/media/CopyUrlButton';
import { createServerClient } from '@/lib/supabase/server';

export default async function MediaPage() {
  const supabase = await createServerClient();
  const { data: productImages } = await supabase
    .from('product_images')
    .select('id, product_id, supabase_url, src')
    .order('created_at', { ascending: false })
    .limit(24);
  const { data: articleImages } = await supabase
    .from('articles')
    .select('id, title, supabase_image_url')
    .order('created_at', { ascending: false })
    .limit(12);

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Media Library</div>
            <div className="helper">Drag and drop up to 10 images. URLs copy in one click.</div>
          </div>
        </div>
        <MediaUploader />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Recent Product Images</div>
        </div>
        <div className="media-grid">
          {(productImages || []).map((img) => (
            <div key={img.id} className="card media-card" style={{ padding: 12 }}>
              <div className="helper">Product #{img.product_id}</div>
              {img.supabase_url ? (
                <>
                  <img src={img.supabase_url} alt="" loading="lazy" style={{ marginTop: 8 }} />
                  <div className="toolbar" style={{ marginTop: 8 }}>
                    <CopyUrlButton url={img.supabase_url} />
                  </div>
                </>
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
        <div className="media-grid">
          {(articleImages || []).map((article) => (
            <div key={article.id} className="card media-card" style={{ padding: 12 }}>
              <div className="helper">{article.title}</div>
              {article.supabase_image_url ? (
                <>
                  <img src={article.supabase_image_url} alt="" loading="lazy" style={{ marginTop: 8 }} />
                  <div className="toolbar" style={{ marginTop: 8 }}>
                    <CopyUrlButton url={article.supabase_image_url} />
                  </div>
                </>
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
