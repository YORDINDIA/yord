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

// Extract plain text from an Agnes Chat Completions result.
export function getCompletionText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const first = choices[0];
  if (!first || typeof first !== 'object') return '';
  const content = (first as { message?: { content?: unknown } }).message?.content;
  return typeof content === 'string' ? content : '';
}
