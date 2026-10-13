'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { cn } from '@yord/ui';
import { sortByPosition } from '@/lib/product';
import { IconButton } from '@/features/ui/IconButton';

interface ProductImage {
  id: number;
  src: string | null;
  alt: string;
  position: number;
}

interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
  /** Artist brand colour, or the theme accent when the vendor has no brand. */
  accentColor?: string;
}

export function ProductGallery({
  images,
  title,
  accentColor = 'var(--accent)',
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const sortedImages = sortByPosition(images);
  const selectedImage = sortedImages[selectedIndex];

  // Every path that changes the image also clears the zoom: the transform is
  // relative to the previous image's frame, so carrying it over landed the next
  // photo mid-crop with no way to tell it was zoomed.
  const goTo = (index: number) => {
    setSelectedIndex(index);
    setIsZoomed(false);
  };

  const goToPrevious = () => {
    goTo(selectedIndex === 0 ? sortedImages.length - 1 : selectedIndex - 1);
  };

  const goToNext = () => {
    goTo(selectedIndex === sortedImages.length - 1 ? 0 : selectedIndex + 1);
  };

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-[3/4] bg-surface-card overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {selectedImage?.src ? (
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt || title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={cn(
                  'object-cover transition-transform duration-500',
                  isZoomed && 'scale-150'
                )}
                // Only the first frame is the LCP: `priority` on a gallery that
                // swaps images preloads every one of them.
                priority={selectedIndex === 0}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-48 h-48 rounded-full opacity-20"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 32%, transparent))`,
                  }}
                />
                <span className="absolute text-text-muted">Product Image</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows — always visible: a hover-only reveal made them
            unreachable on touch and invisible to keyboard users, who could
            still Tab onto them. The translucent surface lives on the wrapper,
            because a `bg-*` in the button's className would race the variant's
            own background for the cascade. */}
        {sortedImages.length > 1 && (
          <>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-surface-page/80">
              <IconButton label="Previous image" variant="ghost" onClick={goToPrevious}>
                <ChevronLeft size={20} />
              </IconButton>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-surface-page/80">
              <IconButton label="Next image" variant="ghost" onClick={goToNext}>
                <ChevronRight size={20} />
              </IconButton>
            </div>
          </>
        )}

        {/* Zoom Toggle */}
        <div className="absolute top-4 right-4 bg-surface-page/80">
          <IconButton
            label={isZoomed ? 'Zoom out' : 'Zoom in'}
            variant="ghost"
            aria-pressed={isZoomed}
            onClick={() => setIsZoomed(!isZoomed)}
          >
            <ZoomIn size={18} />
          </IconButton>
        </div>

        {/* Image Counter */}
        <div className="absolute bottom-4 right-4 px-3 py-1 bg-surface-page/80 text-text-secondary text-sm font-accent tracking-wider">
          {selectedIndex + 1} / {sortedImages.length}
        </div>

        {/* Accent Line */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: accentColor }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
      </div>

      {/* Thumbnails */}
      {sortedImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`View image ${index + 1}`}
              aria-current={selectedIndex === index ? 'true' : undefined}
              className={cn(
                'relative w-20 h-24 flex-shrink-0 bg-surface-card overflow-hidden transition-opacity duration-200',
                selectedIndex === index
                  ? 'ring-2'
                  : 'opacity-60 hover:opacity-100'
              )}
              style={{
                '--tw-ring-color': selectedIndex === index ? accentColor : 'transparent',
              } as React.CSSProperties}
            >
              {image.src ? (
                <Image
                  src={image.src}
                  alt={image.alt || `${title} - thumbnail ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-8 h-8 rounded-full opacity-30"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
