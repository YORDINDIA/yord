'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatPrice } from '@yord/ui';
import type { CartItem } from '@yord/db-types';
import { useCartStore } from '@/lib/stores/cartStore';
import { isPriceOnSale } from '@/lib/product';
import { getSupabaseClient } from '@/lib/supabase/client';
import { IconButton } from '@/features/ui/IconButton';

interface CartLineItemProps {
  item: CartItem;
  onRemove: (item: CartItem) => void;
}

interface SizeOption {
  id: number;
  title: string | null;
  price: number;
  inventory: number | null;
}

/**
 * One bag line: image, size, quantity, price and remove.
 *
 * Three things this fixes beyond the markup:
 * - the quantity value is a live region, so a screen reader hears the new
 *   count after pressing + or − (it was a bare `<span>`);
 * - the size can be changed in place. Sizes come from the same
 *   `product_variants` read the PDP uses, fetched only when the shopper asks
 *   (one request per product, not one per cart line on load);
 * - remove is reversible — `onRemove` hands the item to the parent's undo bar
 *   rather than deleting it behind the shopper's back.
 */
export function CartLineItem({ item, onRemove }: CartLineItemProps) {
  const removeItem = useCartStore((state) => state.removeItem);
  const addItem = useCartStore((state) => state.addItem);
  const closeCart = useCartStore((state) => state.closeCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const sizeSelectId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const [options, setOptions] = useState<SizeOption[] | null>(null);
  const [sizeStatus, setSizeStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const atMax = item.quantity >= item.maxQuantity;

  useEffect(() => {
    // The select appears where the shopper clicked; focus follows so the next
    // keypress lands in the control they just opened.
    if (options && options.length > 1) selectRef.current?.focus();
  }, [options]);

  const loadSizes = async () => {
    if (sizeStatus === 'loading') return;
    setSizeStatus('loading');
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, title, price, inventory_quantity, position')
        .eq('product_id', item.productId)
        .order('position');
      if (error || !data) throw error ?? new Error('No variants');
      setOptions(
        data.map((variant) => ({
          id: variant.id,
          title: variant.title,
          price: Number(variant.price ?? 0),
          inventory: variant.inventory_quantity ?? null,
        }))
      );
      setSizeStatus('idle');
    } catch {
      setSizeStatus('error');
    }
  };

  const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = options?.find((option) => String(option.id) === event.target.value);
    if (!next || next.id === item.variantId) return;

    removeItem(item.variantId);
    addItem(
      {
        ...item,
        variantId: next.id,
        variantTitle: next.title,
        price: next.price,
        maxQuantity: next.inventory && next.inventory > 0 ? next.inventory : 10,
      },
      item.quantity
    );
    // `addItem` is the add-to-bag path and opens the drawer. We are already on
    // the cart page, so it is closed in the same event rather than thrown over
    // the page. A store-level `replaceVariant` action would remove this dance
    // (`lib/stores` is out of scope for this pass).
    closeCart();
  };

  const showSizeControl =
    Boolean(item.variantTitle) &&
    sizeStatus !== 'error' &&
    (options === null || options.length > 1);

  return (
    <div className="flex gap-6 py-6 first:pt-0">
      {/* Image */}
      <Link
        href={`/product/${item.productHandle}`}
        className="relative w-28 h-36 md:w-32 md:h-40 bg-surface-card shrink-0 group"
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(min-width: 768px) 128px, 112px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-text-muted text-xs">
            No image
          </span>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {item.artist && (
          <span className="font-accent text-xs tracking-[0.15em] text-accent">
            {item.artist.toUpperCase()}
          </span>
        )}

        <Link
          href={`/product/${item.productHandle}`}
          className="block font-heading text-xl md:text-2xl text-text-primary hover:text-accent transition-colors line-clamp-2 mt-1"
        >
          {item.title}
        </Link>

        {showSizeControl && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {options === null && (
              <p className="font-body text-sm text-text-muted">
                Size: {item.variantTitle}
              </p>
            )}
            {options === null ? (
              <button
                type="button"
                onClick={loadSizes}
                disabled={sizeStatus === 'loading'}
                className="font-body text-xs text-accent hover:underline disabled:opacity-50"
              >
                {sizeStatus === 'loading' ? 'Loading sizes…' : 'Change size'}
              </button>
            ) : (
              <>
                <label htmlFor={sizeSelectId} className="sr-only">
                  Size for {item.title}
                </label>
                <select
                  id={sizeSelectId}
                  ref={selectRef}
                  value={item.variantId}
                  onChange={handleSizeChange}
                  className="border border-border-default bg-surface-card px-3 py-2 font-body text-sm text-text-secondary focus:border-accent"
                >
                  {options.map((option) => {
                    const soldOut = option.inventory !== null && option.inventory < 1;
                    return (
                      <option key={option.id} value={option.id} disabled={soldOut}>
                        {option.title ?? 'Default'}
                        {soldOut ? ' — sold out' : ''}
                      </option>
                    );
                  })}
                </select>
              </>
            )}
          </div>
        )}

        {sizeStatus === 'error' && (
          <p role="status" className="mt-1 font-body text-xs text-text-muted">
            Could not load sizes.{' '}
            <Link href={`/product/${item.productHandle}`} className="text-accent hover:underline">
              Open the product page
            </Link>
          </p>
        )}

        {/* Price Row */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          {/* Quantity Controls */}
          <div className="flex items-center border border-border-default">
            <IconButton
              label="Decrease quantity"
              size="md"
              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
            >
              <Minus size={16} aria-hidden="true" />
            </IconButton>
            {/* `aria-live` so the new count is announced after a press. */}
            <span
              aria-live="polite"
              className="w-12 h-11 flex items-center justify-center text-text-primary font-body"
            >
              {item.quantity}
            </span>
            <IconButton
              label="Increase quantity"
              size="md"
              disabled={atMax}
              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
            >
              <Plus size={16} aria-hidden="true" />
            </IconButton>
          </div>

          <span className="font-body text-sm text-text-muted">
            {formatPrice(item.price)} each
          </span>
        </div>

        {/* Stock Warning */}
        {item.maxQuantity <= 5 && (
          <p className="mt-3 text-sm text-accent flex items-center gap-2">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Only {item.maxQuantity} left in stock
          </p>
        )}
      </div>

      {/* Price & Remove */}
      <div className="flex flex-col items-end justify-between">
        <IconButton
          label={`Remove ${item.title} from your bag`}
          size="md"
          className="hover:text-danger"
          onClick={() => onRemove(item)}
        >
          <Trash2 size={18} aria-hidden="true" />
        </IconButton>

        <div className="text-right">
          <p className="font-heading text-2xl text-text-primary">
            {formatPrice(item.price * item.quantity)}
          </p>
          {isPriceOnSale(item.price, item.compareAtPrice) && (
            <p className="font-body text-sm text-text-muted line-through">
              {formatPrice((item.compareAtPrice ?? 0) * item.quantity)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
