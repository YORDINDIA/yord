/**
 * Image format sniffing for uploads.
 *
 * The browser sends a WebP variant whenever it can produce one (see
 * `media/uploader.tsx`); browsers that cannot fall back to the original file.
 * Either way the *declared* MIME type comes from the client and cannot be
 * trusted, so the server decides what it is storing from the leading bytes:
 *
 * - JPEG (`ff d8 ff` + a plausible first marker byte)
 * - PNG (`89 50 4e 47 0d 0a 1a 0a`)
 * - WebP (`RIFF....WEBP`)
 *
 * Anything else — SVG, GIF, a text file renamed `.png`, a truncated buffer —
 * is rejected, because R2 stores bytes verbatim and nothing downstream can
 * repair a mislabelled object.
 */
export type ImageFormat = 'jpg' | 'png' | 'webp';

export const CONTENT_TYPE_BY_FORMAT: Record<ImageFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Sniff the image format from its magic bytes, or `null` when unrecognised.
 *
 * The full signature each format actually starts with must be present, not
 * just its prefix: a three-byte `ff d8 ff` file is not a decodable JPEG, so
 * the SOI marker must be followed by a plausible first-segment marker byte —
 * E0-EF (APPn), DB (DQT), DD (DRI), or C0-CF (SOFn/Huffman).
 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    ((bytes[3] >= 0xe0 && bytes[3] <= 0xef) ||
      bytes[3] === 0xdb ||
      bytes[3] === 0xdd ||
      (bytes[3] >= 0xc0 && bytes[3] <= 0xcf))
  ) {
    return 'jpg';
  }
  if (bytes.length >= 8 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'webp';
  }
  return null;
}
