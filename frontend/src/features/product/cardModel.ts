import {
  getFirstByPosition,
  getImageUrl,
  getLowestPriceVariant,
  getPrimaryImage,
  getProductBadge,
  getSecondaryImage,
  isInStock,
} from '@/lib/product';
import type { CartItem, ProductWithDetails } from '@yord/db-types';
import { DEFAULT_MAX_QUANTITY, maxQuantityFor } from './cartItem';

// Props for when using full product data from Supabase
export interface ProductCardWithDataProps {
  product: ProductWithDetails;
  priority?: boolean;
  className?: string;
}

// Simplified props for static/mock data
export interface ProductCardSimpleProps {
  handle: string;
  title: string;
  artist?: string;
  price: number;
  compareAtPrice?: number | null;
  image?: string | null;
  imageSrc?: string; // Alternative prop name for image
  imageAlt?: string;
  secondaryImage?: string | null;
  badge?: 'NEW' | 'SALE' | 'LIMITED' | 'BESTSELLER' | 'TRENDING' | null;
  accentColor?: string;
  inStock?: boolean;
  priority?: boolean;
  className?: string;
  // Optional full product data for cart functionality
  product?: ProductWithDetails;
  // Optional ids for wishlist/cart when full product data is unavailable
  // (e.g. related-product cards that only fetch a subset of columns)
  productId?: number;
  variantId?: number | null;
  variantTitle?: string | null;
  maxQuantity?: number;
}

export type ProductCardProps = ProductCardWithDataProps | ProductCardSimpleProps;

export type CardBadge = 'NEW' | 'SALE' | 'LIMITED' | 'BESTSELLER' | 'TRENDING' | null;

/** Everything the card renders, whichever prop shape it was handed. */
export interface CardModel {
  handle: string;
  title: string;
  artist: string | null;
  price: number;
  compareAtPrice: number | null;
  primaryImageUrl: string | null;
  secondaryImageUrl: string | null;
  badge: CardBadge;
  inStock: boolean;
  priority: boolean;
  className?: string;
  /** Present only when the caller passed the full row (quick view needs it). */
  product: ProductWithDetails | undefined;
  productId: number | null;
  variantId: number | null;
  variantTitle: string | null;
  maxQuantity: number;
}

/**
 * Collapse both prop shapes into one model.
 *
 * The card used to declare fifteen `let`s and assign every one of them twice,
 * once per branch, which is how `inventory_quantity > 0 ? … : 10` ended up
 * written twice inside this file alone.
 *
 * Pure, so it can be reasoned about (and unit-tested) without rendering — the
 * card itself is only JSX plus the two event handlers.
 */
export function normalizeCardProps(props: ProductCardProps): CardModel {
  if ('handle' in props) {
    const product = props.product;
    const variant = product ? getFirstByPosition(product.product_variants) : null;
    return {
      handle: props.handle,
      title: props.title,
      artist: props.artist ?? null,
      price: props.price,
      compareAtPrice: props.compareAtPrice ?? null,
      primaryImageUrl: props.imageSrc || props.image || null,
      secondaryImageUrl: props.secondaryImage || null,
      badge: props.badge ?? null,
      inStock: props.inStock !== false,
      priority: props.priority ?? false,
      className: props.className,
      product,
      // A simple card carries either the full row or just the ids of its
      // cheapest variant (related-product rails fetch a column subset).
      productId: product?.id ?? props.productId ?? null,
      variantId: variant?.id ?? props.variantId ?? null,
      variantTitle: variant?.title ?? props.variantTitle ?? null,
      maxQuantity: variant
        ? maxQuantityFor(variant.inventory_quantity)
        : props.maxQuantity ?? DEFAULT_MAX_QUANTITY,
    };
  }

  const product = props.product;
  const primaryImage = getPrimaryImage(product.product_images);
  const secondaryImage = getSecondaryImage(product.product_images);
  const lowestVariant = getLowestPriceVariant(product.product_variants);

  return {
    handle: product.handle ?? '',
    title: product.title,
    artist: product.vendor ?? null,
    price: lowestVariant?.price ?? 0,
    compareAtPrice: lowestVariant?.compare_at_price ?? null,
    primaryImageUrl: primaryImage ? getImageUrl(primaryImage) : null,
    secondaryImageUrl: secondaryImage ? getImageUrl(secondaryImage) : null,
    badge: getProductBadge(product, lowestVariant),
    inStock: isInStock(product),
    priority: props.priority ?? false,
    className: props.className,
    product,
    productId: product.id,
    variantId: lowestVariant?.id ?? null,
    variantTitle: lowestVariant?.title ?? null,
    maxQuantity: maxQuantityFor(lowestVariant?.inventory_quantity),
  };
}

/** The cart line for the variant the card is showing, when it has one. */
export function toCartItem(card: CardModel): Omit<CartItem, 'quantity'> | null {
  if (card.productId === null || card.variantId === null) return null;
  return {
    variantId: card.variantId,
    productId: card.productId,
    productHandle: card.handle,
    title: card.title,
    variantTitle: card.variantTitle,
    price: card.price,
    compareAtPrice: card.compareAtPrice,
    image: card.primaryImageUrl,
    maxQuantity: card.maxQuantity,
    artist: card.artist,
  };
}
