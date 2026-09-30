// Parse a JSON object out of model text, tolerating prose around the braces.
export function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Unable to parse JSON');
  }
}

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
