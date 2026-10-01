'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/ui/ToastProvider';
import { applyAiImageAction } from '@/server/actions/ai';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { postJson } from '@/lib/utils/post-json';

interface ListingSuggestion {
  title?: string;
  body_html?: string;
  tags?: string;
  collections?: string[];
  notes?: string;
}

/**
 * AI listing studio.
 *
 * `applyImage` used to run `supabase.from('product_images').update(...)` in the
 * browser with the anon key: no `requireAdmin()`, no audit row, and a silent
 * failure path. It now calls `applyAiImageAction`. The product picker and the
 * cover image are passed in from the server instead of being queried from the
 * browser.
 */
export default function AiListingStudio({
  products,
}: {
  products: { id: number; title: string }[];
}) {
  const [productId, setProductId] = useState('');
  const [suggestion, setSuggestion] = useState<ListingSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [cover, setCover] = useState<{ id: number | null; url: string | null } | null>(null);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();
  // Monotonic id for the in-flight cover-image lookup, so a late response for a
  // previous selection is discarded.
  const coverRequestId = useRef(0);
  // Bumped on every product switch. generate()/generateImage() capture it with
  // the requested id and discard the response when it no longer matches, so a
  // slow response for product A can never be applied to product B.
  const sessionRef = useRef(0);
  // Which product/cover the currently displayed suggestion/preview was made
  // for. apply()/applyImage() refuse to submit when the selection moved on.
  const [suggestionFor, setSuggestionFor] = useState<string | null>(null);
  const [imageForCoverId, setImageForCoverId] = useState<number | null>(null);

  // Resetting on selection keeps a stale generated image from being paired with
  // a newly chosen product. This is a click handler, not an effect: the state
  // has to change before the fetch starts, not after a render.
  function selectProduct(nextId: string) {
    setProductId(nextId);
    setSuggestion(null);
    setSuggestionFor(null);
    setAiImageUrl(null);
    setImageForCoverId(null);
    setCover(null);
    sessionRef.current += 1;
    if (!nextId) return;

    // A slow lookup for a product the admin has already navigated away from
    // must not overwrite the current selection's image.
    const requestId = coverRequestId.current + 1;
    coverRequestId.current = requestId;
    fetch(`/api/ai/listing?productId=${encodeURIComponent(nextId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { imageUrl?: string | null; imageId?: number | null } | null) => {
        if (requestId !== coverRequestId.current) return;
        setCover({ id: data?.imageId ?? null, url: data?.imageUrl ?? null });
      })
      .catch(() => {
        if (requestId === coverRequestId.current) toast('Could not load the product image.', 'error');
      });
  }

  async function generate() {
    if (!productId) return;
    const requestedId = productId;
    const session = sessionRef.current;
    setLoading(true);
    const result = await postJson<{ suggestion?: ListingSuggestion | null }>(
      '/api/ai/listing',
      { productId: Number(requestedId) },
      'Failed to generate.',
    );
    setLoading(false);
    if (session !== sessionRef.current) return;
    if (!result.ok) {
      toast(result.message, 'error');
      return;
    }
    setSuggestion(result.data.suggestion ?? null);
    setSuggestionFor(requestedId);
    toast('Suggestions generated. Review before applying.', 'success');
  }

  async function generateImage() {
    if (!cover?.url) return;
    const requestedCoverId = cover.id;
    const requestedUrl = cover.url;
    const session = sessionRef.current;
    setImageLoading(true);
    const result = await postJson<{ previewUrl?: string | null }>(
      '/api/ai/image',
      { imageUrl: requestedUrl, prompt: 'Enhance this product image for premium ecommerce.' },
      'Image generation failed.',
    );
    setImageLoading(false);
    if (session !== sessionRef.current) return;
    if (!result.ok) {
      toast(result.message, 'error');
      return;
    }
    setAiImageUrl(result.data.previewUrl ?? null);
    setImageForCoverId(requestedCoverId);
  }

  async function applyImage() {
    if (!aiImageUrl || !cover?.id) return;
    if (imageForCoverId !== cover.id) {
      toast('That preview belongs to a different product. Generate the image again.', 'error');
      return;
    }
    setApplying(true);
    try {
      const result = await applyAiImageAction({ status: 'idle' }, { imageId: cover.id, url: aiImageUrl });
      if (result.status === 'error') {
        toast(result.formError ?? 'Could not apply the image.', 'error');
        return;
      }
      toast(result.message ?? 'Applied the new image to the product.', 'success');
    } catch {
      toast('Network error, try again.', 'error');
    } finally {
      setApplying(false);
    }
  }

  async function apply() {
    if (!suggestion || !productId) return;
    if (suggestionFor !== productId) {
      toast('That suggestion belongs to a different product. Generate it again.', 'error');
      return;
    }
    setApplying(true);
    const result = await postJson(
      '/api/ai/listing/apply',
      { productId: Number(productId), suggestion },
      'Failed to apply.',
    );
    setApplying(false);
    if (!result.ok) {
      toast(result.message, 'error');
      return;
    }
    toast('Applied suggestion to product.', 'success');
  }

  return (
    <>
      <div className="form-grid">
        <div>
          <label className="helper" htmlFor="ai-product">
            Product
          </label>
          <select
            className="select"
            id="ai-product"
            value={productId}
            onChange={(event) => selectProduct(event.target.value)}
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button
            className="button primary"
            type="button"
            onClick={generate}
            disabled={loading || !productId}
            aria-busy={loading}
          >
            {loading ? 'Generating…' : 'Generate Suggestions'}
          </button>
        </div>
      </div>

      {suggestion && (
        <div className="grid gap-3" style={{ marginTop: 16 }}>
          <div>
            <div className="helper">Title</div>
            <div>{suggestion.title}</div>
          </div>
          <div>
            <div className="helper">Tags</div>
            <div>{suggestion.tags || '—'}</div>
          </div>
          <div>
            <div className="helper">Description</div>
            {/*
              Sanitized at render, not only on save. This is raw model output
              reaching `dangerouslySetInnerHTML` on the admin origin, and the
              server-side `applyListingSuggestionAction` sanitizer only runs
              once the admin clicks Apply — so before the refactor the preview
              was an unsanitized-XSS vector that executed on the page an admin
              uses to run arbitrary AI requests.
            */}
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(suggestion.body_html) }} />
          </div>
          {suggestion.collections && (
            <div>
              <div className="helper">Suggested Collections</div>
              <div>{suggestion.collections.join(', ')}</div>
            </div>
          )}

          {cover?.url && (
            <div>
              <div className="helper">Reference Image</div>
              <Image
                src={cover.url}
                alt={`Reference image for product ${productId}`}
                width={720}
                height={720}
                sizes="(max-width: 768px) 100vw, 480px"
                style={{ width: '100%', height: 'auto', borderRadius: 12, marginTop: 8 }}
              />
            </div>
          )}

          <div className="toolbar">
            <button
              className="button"
              type="button"
              onClick={generateImage}
              disabled={imageLoading || !cover?.url}
              aria-busy={imageLoading}
            >
              {imageLoading ? 'Generating Image…' : 'Generate Improved Image'}
            </button>
            {aiImageUrl && (
              <button
                className="button"
                type="button"
                onClick={applyImage}
                disabled={applying}
                aria-busy={applying}
              >
                {applying ? 'Applying…' : 'Apply Image'}
              </button>
            )}
            <button className="button primary" type="button" onClick={apply} disabled={applying} aria-busy={applying}>
              {applying ? 'Applying…' : 'Apply Suggestion'}
            </button>
          </div>

          {aiImageUrl && (
            <div>
              <div className="helper">AI Image Preview</div>
              <Image
                src={aiImageUrl}
                alt="AI-generated product image preview"
                width={720}
                height={720}
                sizes="(max-width: 768px) 100vw, 480px"
                style={{ width: '100%', height: 'auto', borderRadius: 12, marginTop: 8 }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
