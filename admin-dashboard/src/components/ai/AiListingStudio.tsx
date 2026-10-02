'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import CopyButton from './CopyButton';
import GeneratingLines from './GeneratingLines';
import InlineError, { InlineSuccess } from './InlineError';
import ProductPicker, { type ProductOption } from './ProductPicker';
import styles from './ai.module.css';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
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

/** Shopify-style tag string (`a, b, c`) as chips. */
function tagChips(tags: string): string[] {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Model output is untyped JSON; only strings may reach the DOM. */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * AI listing studio: pick a product, generate copy and an improved cover, then
 * apply.
 *
 * Everything that talks to Agnes, and the mutation that writes to
 * `product_images`, went through this component's predecessors: the
 * `supabase.from('product_images').update(...)` that ran in the browser with the
 * publishable key is now `applyAiImageAction`, and the cover lookup is the
 * admin-only `GET /api/ai/listing`. The request bodies and the `ok`/`data`/`error`
 * envelope handling are unchanged.
 *
 * Model output is untrusted JSON: every field is type-checked before it reaches
 * the DOM, and the description goes through `sanitizeHtml` at render — the apply
 * action sanitizes again on the way into the database, but that only runs after
 * a click, and the preview must not be a script-execution surface on the admin
 * origin.
 */
export default function AiListingStudio({ products }: { products: ProductOption[] }) {
  const [productId, setProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [suggestion, setSuggestion] = useState<ListingSuggestion | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cover, setCover] = useState<{ id: number | null; url: string | null } | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageApplied, setImageApplied] = useState(false);
  const [applyingImage, setApplyingImage] = useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = useState(false);
  const [appliedSuggestion, setAppliedSuggestion] = useState(false);
  const [live, setLive] = useState('');
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
    setCoverLoading(false);
    setError(null);
    setImageError(null);
    setImageApplied(false);
    setAppliedSuggestion(false);
    setLive('');
    sessionRef.current += 1;
    if (!nextId) return;

    // A slow lookup for a product the admin has already navigated away from
    // must not overwrite the current selection's image.
    const requestId = coverRequestId.current + 1;
    coverRequestId.current = requestId;
    setCoverLoading(true);
    fetch(`/api/ai/listing?productId=${encodeURIComponent(nextId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { imageUrl?: string | null; imageId?: number | null } | null) => {
        if (requestId !== coverRequestId.current) return;
        setCover({ id: data?.imageId ?? null, url: data?.imageUrl ?? null });
        setCoverLoading(false);
      })
      .catch(() => {
        if (requestId !== coverRequestId.current) return;
        setCoverLoading(false);
        setError('Could not load the product image.');
      });
  }

  async function generate() {
    if (!productId) return;
    const requestedId = productId;
    const session = sessionRef.current;
    setGenerating(true);
    setError(null);
    setAppliedSuggestion(false);
    const result = await postJson<{ suggestion?: ListingSuggestion | null }>(
      '/api/ai/listing',
      { productId: Number(requestedId) },
      'Failed to generate.',
    );
    setGenerating(false);
    if (session !== sessionRef.current) return;
    if (!result.ok) {
      setError(result.message);
      setLive('Generation failed');
      return;
    }
    setSuggestion(result.data.suggestion ?? null);
    setSuggestionFor(requestedId);
    setLive('Suggestion ready');
    toast('Suggestions generated. Review before applying.', 'success');
  }

  async function generateImage() {
    if (!cover?.url) return;
    const requestedCoverId = cover.id;
    const requestedUrl = cover.url;
    const session = sessionRef.current;
    setImageLoading(true);
    setImageError(null);
    setImageApplied(false);
    const result = await postJson<{ previewUrl?: string | null }>(
      '/api/ai/image',
      { imageUrl: requestedUrl, prompt: 'Enhance this product image for premium ecommerce.' },
      'Image generation failed.',
    );
    setImageLoading(false);
    if (session !== sessionRef.current) return;
    if (!result.ok) {
      setImageError(result.message);
      setLive('Image generation failed');
      return;
    }
    setAiImageUrl(result.data.previewUrl ?? null);
    setImageForCoverId(requestedCoverId);
    setLive('Image preview ready');
  }

  async function applyImage() {
    if (!aiImageUrl || !cover?.id) return;
    if (imageForCoverId !== cover.id) {
      setImageError('That preview belongs to a different product. Generate the image again.');
      return;
    }
    setApplyingImage(true);
    try {
      const result = await applyAiImageAction({ status: 'idle' }, { imageId: cover.id, url: aiImageUrl });
      if (result.status === 'error') {
        setImageError(result.formError ?? 'Could not apply the image.');
        return;
      }
      setImageError(null);
      setImageApplied(true);
      setLive('Image applied to the product');
      toast(result.message ?? 'Applied the new image to the product.', 'success');
    } catch {
      setImageError('Network error, try again.');
    } finally {
      setApplyingImage(false);
    }
  }

  async function apply() {
    if (!suggestion || !productId) return;
    if (suggestionFor !== productId) {
      setError('That suggestion belongs to a different product. Generate it again.');
      return;
    }
    setApplyingSuggestion(true);
    const result = await postJson(
      '/api/ai/listing/apply',
      { productId: Number(productId), suggestion },
      'Failed to apply.',
    );
    setApplyingSuggestion(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setAppliedSuggestion(true);
    setLive('Suggestion applied to the product');
    toast('Applied suggestion to product.', 'success');
  }

  // The model returns untyped JSON; a non-string field would otherwise reach
  // `dangerouslySetInnerHTML` or throw as a React child.
  const title = asText(suggestion?.title);
  const bodyHtml = asText(suggestion?.body_html);
  const tags = asText(suggestion?.tags);
  const notes = asText(suggestion?.notes);
  const collections = Array.isArray(suggestion?.collections)
    ? suggestion.collections.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const chips = tagChips(tags);
  const selectedTitle =
    selectedProduct?.title ??
    products.find((product) => String(product.id) === productId)?.title ??
    `#${productId}`;

  // Order matters: an apply failure with a good suggestion on screen must not
  // relabel the panel "Generation failed".
  const status = generating
    ? { value: 'pending', label: 'Writing…' }
    : suggestion
      ? { value: 'complete', label: 'Suggestion ready' }
      : error
        ? { value: 'failed', label: 'Generation failed' }
        : null;

  return (
    <>
      {/* Screen-reader status; the visible half is the badge in step 2. */}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-title">1 · Pick a product</div>
            <div className="helper">
              The suggestion is written from the product&apos;s current title, vendor, type, tags and
              description.
            </div>
          </div>
        </div>

        <ProductPicker
          products={products}
          selectedId={productId}
          onSelect={(nextId, product) => {
            setSelectedProduct(product);
            selectProduct(nextId);
          }}
          disabled={generating}
        />

        <div className="form-actions">
          <button
            className="button primary"
            type="button"
            onClick={generate}
            disabled={generating || !productId}
            aria-busy={generating}
          >
            <Wand2 size={13} aria-hidden /> {generating ? 'Generating…' : 'Generate suggestion'}
          </button>
          <button
            className="button"
            type="button"
            onClick={generate}
            disabled={generating || !productId || !suggestion}
          >
            <RefreshCw size={13} aria-hidden /> Regenerate
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="section-title">2 · Review and apply</div>
            <div className="helper">
              Nothing is written to the product until you apply. Title, tags and description are the
              fields that land.
            </div>
          </div>
          {status && <StatusBadge value={status.value} label={status.label} dot />}
        </div>

        {error && <InlineError message={error} />}

        {generating && (
          <GeneratingLines label="Asking Agnes for a new title, description and tags…" />
        )}

        {!generating && !suggestion && (
          <EmptyState
            icon={<Sparkles size={22} />}
            title={productId ? 'Ready to generate' : 'Pick a product to start'}
            hint={
              productId
                ? `Generate a suggestion for ${selectedTitle} and it will appear here for review.`
                : 'Search the catalog above, choose a product, then generate a suggestion.'
            }
          />
        )}

        {!generating && suggestion && (
          <div className="stack-sm">
            {appliedSuggestion && (
              <InlineSuccess
                message={`Applied to ${selectedTitle} — title, tags and description updated.`}
              />
            )}

            <div className={styles.artefact}>
              <span className="helper-strong">Title</span>
              <CopyButton value={title} ariaLabel="Copy title" />
            </div>
            <div className="strong">{title || '—'}</div>

            <div className={styles.artefact} style={{ marginTop: 8 }}>
              <span className="helper-strong">Tags</span>
              <CopyButton value={tags} ariaLabel="Copy tags" />
            </div>
            {chips.length > 0 ? (
              <div className="tag-list">
                {chips.map((chip) => (
                  <span key={chip} className="chip tone tone-saffron">
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <span className="helper">No tags suggested.</span>
            )}

            <div className={styles.artefact} style={{ marginTop: 8 }}>
              <span className="helper-strong">Suggested collections</span>
              <CopyButton value={collections.join(', ')} ariaLabel="Copy suggested collections" />
            </div>
            {collections.length > 0 ? (
              <>
                <div className="tag-list">
                  {collections.map((entry) => (
                    <span key={entry} className="chip">
                      {entry}
                    </span>
                  ))}
                </div>
                <span className="helper">
                  Advisory only — applying a suggestion never changes collection membership.
                </span>
              </>
            ) : (
              <span className="helper">No collections suggested.</span>
            )}

            {notes && (
              <>
                <div className={styles.artefact} style={{ marginTop: 8 }}>
                  <span className="helper-strong">Notes for the reviewer (not applied)</span>
                  <CopyButton value={notes} ariaLabel="Copy notes" />
                </div>
                <p className="helper helper-strong" style={{ lineHeight: 1.5 }}>
                  {notes}
                </p>
              </>
            )}

            <div className={styles.artefact} style={{ marginTop: 8 }}>
              <span className="helper-strong">Description (HTML)</span>
              <CopyButton value={bodyHtml} ariaLabel="Copy description HTML" />
            </div>
            {bodyHtml ? (
              <div
                className="prose-admin"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }}
              />
            ) : (
              <span className="helper">No description returned.</span>
            )}

            <div className="form-actions">
              <button
                className="button primary"
                type="button"
                onClick={apply}
                disabled={applyingSuggestion}
                aria-busy={applyingSuggestion}
              >
                {applyingSuggestion ? 'Applying…' : 'Apply suggestion'}
              </button>
            </div>
          </div>
        )}

        {productId && (
          <div className="form-section" style={{ marginTop: 12 }}>
            <div className="form-section-header">
              <ImageIcon size={14} aria-hidden style={{ flex: 'none' }} />
              <span>Cover image</span>
            </div>

            <div className={styles.imageGrid}>
              <div className={styles.imageFrame}>
                <div className="row-between">
                  <span className="helper-strong">Current cover</span>
                  {cover?.id != null && <span className="helper num">#{cover.id}</span>}
                </div>
                <div className={styles.imageBox}>
                  {coverLoading ? (
                    <span className="skeleton" style={{ width: '100%', height: '100%' }} />
                  ) : cover?.url ? (
                    <Image
                      src={cover.url}
                      alt={`Current cover for ${selectedTitle}`}
                      fill
                      sizes="(max-width: 767px) 100vw, 320px"
                    />
                  ) : (
                    <span className={styles.imageNote}>No cover image on this product.</span>
                  )}
                </div>
              </div>

              <div className={styles.imageFrame}>
                <div className="row-between">
                  <span className="helper-strong">AI preview</span>
                  {imageApplied && <StatusBadge value="applied" label="Applied" dot />}
                </div>
                <div className={styles.imageBox}>
                  {imageLoading ? (
                    <span className="skeleton" style={{ width: '100%', height: '100%' }} />
                  ) : aiImageUrl ? (
                    <Image
                      src={aiImageUrl}
                      alt="AI-generated product image preview"
                      fill
                      sizes="(max-width: 767px) 100vw, 320px"
                    />
                  ) : (
                    <span className={styles.imageNote}>
                      Not generated yet — the preview lands here.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {imageError && (
              <div style={{ marginTop: 10 }}>
                <InlineError message={imageError} />
              </div>
            )}

            <div className="toolbar" style={{ marginTop: 10 }}>
              <button
                className="button"
                type="button"
                onClick={generateImage}
                disabled={imageLoading || !cover?.url}
                aria-busy={imageLoading}
              >
                <Wand2 size={13} aria-hidden />
                {imageLoading ? 'Generating image…' : aiImageUrl ? 'Generate again' : 'Generate improved image'}
              </button>
              {aiImageUrl && (
                <button
                  className="button primary"
                  type="button"
                  onClick={applyImage}
                  disabled={applyingImage}
                  aria-busy={applyingImage}
                >
                  {applyingImage ? 'Applying…' : 'Apply image'}
                </button>
              )}
              {!cover?.url && !coverLoading && (
                <span className="helper">This product has no cover to improve.</span>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
