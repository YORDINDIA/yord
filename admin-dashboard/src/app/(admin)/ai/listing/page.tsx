"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ListingSuggestion {
  title?: string;
  body_html?: string;
  tags?: string;
  collections?: string[];
  notes?: string;
}

export default function ListingAiPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<{ id: number; title: string }[]>([]);
  const [productId, setProductId] = useState<string>('');
  const [suggestion, setSuggestion] = useState<ListingSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<number | null>(null);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    supabase.from('products').select('id, title').order('updated_at', { ascending: false }).limit(50)
      .then(({ data }) => setProducts(data || []));
  }, []);


  useEffect(() => {
    if (!productId) return;
    // Deferred: syncs selected-product (external DB row) to local image state.
    queueMicrotask(() => setAiImageUrl(null));
    supabase.from('product_images').select('id, supabase_url, src').eq('product_id', Number(productId)).order('position', { ascending: true }).limit(1)
      .then(({ data }) => {
        const img = data?.[0];
        setImageUrl(img?.supabase_url || img?.src || null);
        setImageId(img?.id ?? null);
      });
  }, [productId]);

  async function generate() {
    if (!productId) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/ai/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Failed to generate');
        return;
      }
      setSuggestion(data.suggestion);
    } catch {
      setMessage('Network error, try again.');
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    if (!imageUrl) return;
    setImageLoading(true);
    try {
      const response = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, prompt: 'Enhance this product image for premium ecommerce.' }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || 'Image generation failed');
        return;
      }
      setAiImageUrl(data.previewUrl);
    } catch {
      setMessage('Network error, try again.');
    } finally {
      setImageLoading(false);
    }
  }

  async function applyImage() {
    if (!aiImageUrl || !imageId) return;
    await supabase.from('product_images')
      .update({ supabase_url: aiImageUrl, updated_at: new Date().toISOString() })
      .eq('id', imageId);
    setMessage('Applied new image to product.');
  }

  async function apply() {
    if (!suggestion || !productId) return;
    const response = await fetch('/api/ai/listing/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: Number(productId), suggestion }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Failed to apply');
      return;
    }
    setMessage('Applied suggestion to product.');
  }

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Improve Listing</div>
            <div className="helper">Generate better copy and tags. Approve to apply.</div>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label className="helper">Product</label>
            <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.title}</option>
              ))}
            </select>
          </div>
          <div>
            <button className="button primary" type="button" onClick={generate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Suggestions'}
            </button>
          </div>
        </div>
      </div>

      {suggestion && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">AI Suggestions</div>
              <div className="helper">Review changes before applying.</div>
            </div>
            <button className="button" onClick={apply}>Apply</button>
          </div>
          <div className="grid gap-3">
            <div>
              <div className="helper">Title</div>
              <div>{suggestion.title}</div>
            </div>
            <div>
              <div className="helper">Tags</div>
              <div>{suggestion.tags}</div>
            </div>
            <div>
              <div className="helper">Description</div>
              <div dangerouslySetInnerHTML={{ __html: suggestion.body_html || '' }} />
            </div>
            {suggestion.collections && (
              <div>
                <div className="helper">Suggested Collections</div>
                <div>{suggestion.collections.join(', ')}</div>
              </div>
            )}

            {imageUrl && (
              <div>
                <div className="helper">Reference Image</div>
                <img src={imageUrl} alt="Reference" style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="button" type="button" onClick={generateImage} disabled={imageLoading}>
                {imageLoading ? 'Generating Image...' : 'Generate Improved Image'}
              </button>
              {aiImageUrl && <button className="button" type="button" onClick={applyImage}>Apply Image</button>}
            </div>
            {aiImageUrl && (
              <div>
                <div className="helper">AI Image Preview</div>
                <img src={aiImageUrl} alt="AI Preview" style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
              </div>
            )}
          </div>
        </div>
      )}
      {message && <div className="card"><div className="helper">{message}</div></div>}
    </div>
  );
}
