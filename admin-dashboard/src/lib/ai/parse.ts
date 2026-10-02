// Parse a JSON object out of model text, tolerating prose around the braces.
export function extractJson(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
      throw new Error('Unable to parse JSON');
    }
    parsed = JSON.parse(text.slice(start, end + 1));
  }
  // Both call sites persist/return the result as a suggestion object: a valid
  // but non-object payload (`[]`, `null`, `"text"`) must be rejected here, not
  // stored as an unusable suggestion.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object');
  }
  return parsed as Record<string, unknown>;
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
