'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@yord/ui';
import { useCartStore } from '@/lib/stores/cartStore';
import { VariantPicker } from '@/features/product/VariantPicker';
import type { RailPiece } from './pieces';
import { ArrowOut, Cross } from './Glyphs';

interface PieceSheetProps {
  piece: RailPiece;
  position: string;
  /** Move focus to the title on mount: true when opened, false when browsed to. */
  takeFocus: boolean;
  onClose: () => void;
}

/** "Pick a piece": the picked garment's details, beside it on the rail. */
export function PieceSheet({ piece, position, takeFocus, onClose }: PieceSheetProps) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstAvailable = piece.sizes.find((s) => s.available) ?? null;
  const [sizeId, setSizeId] = useState<number | null>(firstAvailable?.variantId ?? null);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const size = piece.sizes.find((s) => s.variantId === sizeId) ?? null;
  const price = size?.price ?? piece.price;
  const compareAt = size?.compareAtPrice ?? piece.compareAtPrice;
  const onSale = compareAt !== null && compareAt > price;
  const canBuy = piece.productId !== null && size !== null && size.available;

  const focusOnMount = useRef(takeFocus);
  useEffect(() => {
    if (focusOnMount.current) headingRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function addToBag() {
    if (!size || !size.available || piece.productId === null) return;
    addItem({
      variantId: size.variantId,
      productId: piece.productId,
      productHandle: piece.handle,
      title: piece.title,
      variantTitle: size.variantTitle,
      price: size.price,
      compareAtPrice: size.compareAtPrice,
      image: piece.image,
      maxQuantity: size.maxQuantity,
      artist: piece.artist,
    });
    openCart();
  }

  return (
    <aside className="rl-sheet" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
      <button type="button" className="rl-sheet__back" onClick={onClose}>
        <Cross />
        Back to the rail
      </button>

      <p className="rl-sheet__pos">
        {position}
        <span>{piece.artist}</span>
      </p>
      <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="rl-sheet__title">
        {piece.title}
      </h2>
      <p className="rl-sheet__price">
        {formatPrice(price)}
        {onSale && <s>{formatPrice(compareAt)}</s>}
      </p>

      {piece.sizes.length > 1 && (
        <div className="rl-sheet__sizes">
          <VariantPicker
            label={piece.optionName}
            name={`${id}-size`}
            choices={piece.sizes.map((s) => ({ id: s.variantId, label: s.label, available: s.available }))}
            selectedId={sizeId}
            onSelect={setSizeId}
          />
        </div>
      )}

      <div className="rl-sheet__actions">
        {piece.productId !== null && (
          <button type="button" className="rl-buy" onClick={addToBag} disabled={!canBuy}>
            {piece.sizes.some((s) => s.available) ? 'Add to bag' : 'Sold out'}
          </button>
        )}
        <Link href={`/product/${piece.handle}`} className="rl-link rl-sheet__more">
          View the piece
          <ArrowOut />
        </Link>
      </div>
    </aside>
  );
}
