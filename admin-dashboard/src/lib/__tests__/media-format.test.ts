import { describe, expect, it } from 'vitest';
import { ALLOWED_MEDIA_TYPES } from '@/lib/constants';
import { CONTENT_TYPE_BY_FORMAT, sniffImageFormat } from '@/lib/media-format';

/** Real magic-byte prefixes for the three formats the bucket stores. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
]);

describe('sniffImageFormat', () => {
  it('recognises JPEG, PNG, and WebP from their leading bytes', () => {
    expect(sniffImageFormat(JPEG)).toBe('jpg');
    expect(sniffImageFormat(PNG)).toBe('png');
    expect(sniffImageFormat(WEBP)).toBe('webp');
  });

  it('rejects formats the bucket must not store', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const text = new TextEncoder().encode('not an image at all');
    expect(sniffImageFormat(svg)).toBeNull();
    expect(sniffImageFormat(gif)).toBeNull();
    expect(sniffImageFormat(text)).toBeNull();
  });

  it('rejects empty and truncated buffers instead of guessing', () => {
    expect(sniffImageFormat(new Uint8Array())).toBeNull();
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageFormat(PNG.slice(0, 4))).toBeNull();
    // RIFF header without the WEBP tag: a WAV file, not an image.
    const riff = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffImageFormat(riff)).toBeNull();
  });
});

describe('content type mapping', () => {
  it('covers every MIME type the upload form accepts', () => {
    const stored = Object.values(CONTENT_TYPE_BY_FORMAT);
    for (const mime of ALLOWED_MEDIA_TYPES) {
      expect(stored, mime).toContain(mime);
    }
  });
});
