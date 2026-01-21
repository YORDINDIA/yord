import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ProductVariant, ProductImage, ProductWithDetails, BadgeType, TransformedProduct, TransformedProductWithSource } from '@/types/database';
import { ARTISTS } from '@/types/database';

/**
 * Merge Tailwind classes with clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in INR
 */
export function formatPrice(price: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Get primary image URL (prefer Supabase URL, fallback to Shopify CDN)
 */
export function getImageUrl(image: ProductImage | null | undefined): string {
  if (!image) return '/placeholder-product.jpg';
  return image.supabase_url || image.src;
}

/**
 * Get primary product image
 */
export function getPrimaryImage(images: ProductImage[] | undefined): ProductImage | null {
  if (!images || images.length === 0) return null;

  // Sort by position and get first
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return sorted[0];
}

/**
 * Get secondary image for hover effect
 */
export function getSecondaryImage(images: ProductImage[] | undefined): ProductImage | null {
  if (!images || images.length < 2) return null;

  const sorted = [...images].sort((a, b) => a.position - b.position);
  return sorted[1];
}

/**
 * Get lowest price variant
 */
export function getLowestPriceVariant(variants: ProductVariant[] | undefined): ProductVariant | null {
  if (!variants || variants.length === 0) return null;

  return variants.reduce((min, v) =>
    v.price < min.price ? v : min
  , variants[0]);
}

/**
 * Check if product is on sale
 */
export function isOnSale(variant: ProductVariant | null): boolean {
  if (!variant) return false;
  return !!variant.compare_at_price && variant.compare_at_price > variant.price;
}

/**
 * Calculate discount percentage
 */
export function getDiscountPercentage(variant: ProductVariant | null): number {
  if (!variant || !variant.compare_at_price) return 0;

  const discount = ((variant.compare_at_price - variant.price) / variant.compare_at_price) * 100;
  return Math.round(discount);
}

/**
 * Check if product is in stock
 */
export function isInStock(product: ProductWithDetails): boolean {
  if (!product.product_variants || product.product_variants.length === 0) return false;

  return product.product_variants.some(v => v.inventory_quantity > 0);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

/**
 * Strip HTML tags from string
 */
export function stripHtml(html: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get size display order
 */
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];

export function sortSizes(sizes: string[]): string[] {
  return sizes.sort((a, b) => {
    const aIndex = SIZE_ORDER.indexOf(a.toUpperCase());
    const bIndex = SIZE_ORDER.indexOf(b.toUpperCase());

    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;
  });
}

/**
 * Get unique option values from variants
 */
export function getUniqueOptionValues(
  variants: ProductVariant[],
  optionKey: 'option1' | 'option2' | 'option3'
): string[] {
  const values = variants
    .map(v => v[optionKey])
    .filter((v): v is string => v !== null && v !== undefined);

  return [...new Set(values)];
}

/**
 * Find variant by option combination
 */
export function findVariantByOptions(
  variants: ProductVariant[],
  option1?: string | null,
  option2?: string | null,
  option3?: string | null
): ProductVariant | null {
  return variants.find(v =>
    (!option1 || v.option1 === option1) &&
    (!option2 || v.option2 === option2) &&
    (!option3 || v.option3 === option3)
  ) || null;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Estimate reading time based on content length
 */
export function estimateReadTime(htmlContent: string): number {
  const text = htmlContent.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).length;
  const wordsPerMinute = 200;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT TRANSFORMATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine the badge type for a product based on various factors
 */
export function getProductBadge(
  product: ProductWithDetails,
  variant?: ProductVariant | null
): BadgeType | null {
  const activeVariant = variant || getLowestPriceVariant(product.product_variants);

  // Check if on sale (highest priority)
  if (activeVariant?.compare_at_price && activeVariant.compare_at_price > activeVariant.price) {
    return 'SALE';
  }

  // Check if low stock
  if (activeVariant?.inventory_quantity && activeVariant.inventory_quantity <= 5) {
    return 'LIMITED';
  }

  // Check if new (published within last 30 days)
  if (product.published_at) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (new Date(product.published_at).getTime() > thirtyDaysAgo) {
      return 'NEW';
    }
  }

  // Check tags for special badges
  const tags = product.tags?.toLowerCase() || '';
  if (tags.includes('limited')) return 'LIMITED';
  if (tags.includes('bestseller')) return 'BESTSELLER';
  if (tags.includes('trending')) return 'TRENDING';

  return null;
}

/**
 * Get artist accent color from vendor name
 */
export function getArtistAccentColor(vendor: string | null): string {
  if (!vendor) return '#FFD700'; // Default gold

  const handle = vendor.toLowerCase().replace(/\s+/g, '-');
  const artistData = ARTISTS[handle];
  return artistData?.accentColor || '#FFD700';
}

/**
 * Transform a ProductWithDetails into a TransformedProduct for UI display
 */
export function transformProductForCard(
  product: ProductWithDetails,
  overrides?: {
    artist?: string;
    accentColor?: string;
  }
): TransformedProduct {
  const variant = product.product_variants?.sort((a, b) => a.position - b.position)[0];
  const image = product.product_images?.sort((a, b) => a.position - b.position)[0];
  const artist = overrides?.artist || product.vendor || '';

  return {
    id: product.id.toString(),
    handle: product.handle,
    title: product.title,
    artist,
    price: variant?.price || 0,
    compareAtPrice: variant?.compare_at_price || null,
    image: image?.supabase_url || image?.src || null,
    badge: getProductBadge(product, variant),
    accentColor: overrides?.accentColor || getArtistAccentColor(product.vendor),
  };
}

/**
 * Sort products by price (client-side, for when price is on variants)
 */
export function sortProductsByPrice(
  products: ProductWithDetails[],
  direction: 'asc' | 'desc'
): ProductWithDetails[] {
  return [...products].sort((a, b) => {
    const priceA = a.product_variants?.[0]?.price || 0;
    const priceB = b.product_variants?.[0]?.price || 0;
    return direction === 'asc' ? priceA - priceB : priceB - priceA;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION SORTING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sort items by position (ascending)
 * Common for product_variants and product_images
 */
export function sortByPosition<T extends { position: number }>(items: T[] | undefined): T[] {
  if (!items || items.length === 0) return [];
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * Get first item sorted by position
 */
export function getFirstByPosition<T extends { position: number }>(items: T[] | undefined): T | null {
  const sorted = sortByPosition(items);
  return sorted[0] ?? null;
}

/**
 * Transform a ProductWithDetails into a TransformedProductWithSource for UI display
 * Includes the original product data for components that need it
 */
export function transformProductForCardWithSource(
  product: ProductWithDetails,
  overrides?: {
    artist?: string;
    accentColor?: string;
  }
): TransformedProductWithSource {
  const base = transformProductForCard(product, overrides);
  return {
    ...base,
    originalProduct: product,
  };
}

