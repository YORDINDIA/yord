'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImage {
  id: number;
  src: string | null;
  alt: string;
  position: number;
}

interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
  accentColor?: string;
}

export function ProductGallery({ images, title, accentColor = '#FFD966' }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const sortedImages = [...images].sort((a, b) => a.position - b.position);
  const selectedImage = sortedImages[selectedIndex];

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? sortedImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setSelectedIndex((prev) => (prev === sortedImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-[3/4] bg-noir-900 overflow-hidden group">
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
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-48 h-48 rounded-full opacity-20"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}50)`,
                  }}
                />
                <span className="absolute text-ivory-400">Product Image</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {sortedImages.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-noir-950/80 text-ivory-100 hover:bg-gold-200 hover:text-noir-950 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-noir-950/80 text-ivory-100 hover:bg-gold-200 hover:text-noir-950 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Zoom Toggle */}
        <button
          onClick={() => setIsZoomed(!isZoomed)}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-noir-950/80 text-ivory-100 hover:bg-gold-200 hover:text-noir-950 transition-colors opacity-0 group-hover:opacity-100"
          aria-label={isZoomed ? 'Zoom out' : 'Zoom in'}
        >
          <ZoomIn size={18} />
        </button>

        {/* Image Counter */}
        <div className="absolute bottom-4 right-4 px-3 py-1 bg-noir-950/80 text-ivory-100 text-sm font-[family-name:var(--font-bebas)] tracking-wider">
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
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                'relative w-20 h-24 flex-shrink-0 bg-noir-900 overflow-hidden transition-all duration-200',
                selectedIndex === index
                  ? 'ring-2'
                  : 'opacity-60 hover:opacity-100'
              )}
              style={{
                '--tw-ring-color': selectedIndex === index ? accentColor : 'transparent',
              } as React.CSSProperties}
              aria-label={`View image ${index + 1}`}
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
