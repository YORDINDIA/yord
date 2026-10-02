/** Estimate reading time (minutes) based on content length. */
export function estimateReadTime(htmlContent: string): number {
  const text = htmlContent.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).length;
  const wordsPerMinute = 200;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
