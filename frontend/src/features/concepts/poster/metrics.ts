/* Tanker advance widths per 1000 units, measured in Chrome (kerning ignored).
   Lets the server size a headline to the container without measuring text. */
const ADVANCE: Record<string, number> = {
  A: 438, B: 463, C: 439, D: 464, E: 393, F: 389, G: 448, H: 480, I: 224, J: 318,
  K: 469, L: 363, M: 612, N: 494, O: 452, P: 447, Q: 452, R: 463, S: 430, T: 378,
  U: 462, V: 432, W: 654, X: 444, Y: 422, Z: 371, ' ': 165,
  '0': 464, '1': 285, '2': 422, '3': 436, '4': 465, '5': 445, '6': 456, '7': 389,
  '8': 454, '9': 456, '&': 483, '.': 188, "'": 181, '-': 289, '!': 234,
};

/** Width of `text` in em when set in Tanker caps. */
export function tankerEm(text: string): number {
  let sum = 0;
  for (const ch of text.toUpperCase()) sum += ADVANCE[ch] ?? 440;
  return Math.round(sum) / 1000;
}
