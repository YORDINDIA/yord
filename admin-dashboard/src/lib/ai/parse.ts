// Extract plain text from an OpenAI Responses API result.
export function getOutputText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const res = response as { output_text?: unknown; output?: unknown };
  if (typeof res.output_text === 'string') return res.output_text;
  if (!Array.isArray(res.output)) return '';
  const parts: string[] = [];
  for (const item of res.output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const text = (block as { text?: unknown; type?: unknown }).text;
      if (typeof text === 'string') parts.push(text);
      else if (text && typeof text === 'object' && typeof (text as { value?: unknown }).value === 'string') {
        parts.push((text as { value: string }).value);
      }
    }
  }
  return parts.join('');
}
