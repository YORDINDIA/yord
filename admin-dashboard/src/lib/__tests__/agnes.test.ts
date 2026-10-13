import { describe, expect, it } from 'vitest';
import {
  buildImageEditBody,
  IMAGE_RATIO,
  IMAGE_SIZE,
  imageModel,
  resolveAgnesConfig,
} from '@/lib/ai/agnes';
import { getCompletionText } from '@/lib/ai/parse';

/**
 * Agnes AI request shapes. These pin down the two contracts that fail loudly
 * upstream and silently here: `response_format`/`image` must sit under
 * `extra_body` (top-level is an API error), and text is read from the
 * Chat Completions `choices[0].message.content` field.
 */
describe('buildImageEditBody', () => {
  it('keeps response_format and image under extra_body', () => {
    const body = buildImageEditBody('enhance the cover', 'https://cdn.shopify.com/a.jpg');
    expect(body.extra_body.response_format).toBe('b64_json');
    expect(body.extra_body.image).toEqual(['https://cdn.shopify.com/a.jpg']);
    expect(body).not.toHaveProperty('response_format');
    expect(body).not.toHaveProperty('image');
  });

  it('requests the 1K square tier and the configured model', () => {
    const body = buildImageEditBody('p', 'https://cdn.shopify.com/a.jpg');
    expect(body.size).toBe(IMAGE_SIZE);
    expect(body.ratio).toBe(IMAGE_RATIO);
    expect(body.model).toBe(imageModel);
  });
});

describe('getCompletionText', () => {
  it('reads the Chat Completions content', () => {
    expect(getCompletionText({ choices: [{ message: { content: 'hello' } }] })).toBe('hello');
  });

  it('returns empty text for malformed or empty results', () => {
    expect(getCompletionText(null)).toBe('');
    expect(getCompletionText('text')).toBe('');
    expect(getCompletionText({})).toBe('');
    expect(getCompletionText({ choices: [] })).toBe('');
    expect(getCompletionText({ choices: [{ message: { content: null } }] })).toBe('');
  });
});

describe('resolveAgnesConfig', () => {
  it('defaults to the Agnes API hub and models', () => {
    expect(resolveAgnesConfig({})).toEqual({
      baseUrl: 'https://apihub.agnes-ai.com/v1',
      textModel: 'agnes-3.0-flash',
      imageModel: 'agnes-image-2.5-flash',
    });
  });

  it('honours overrides and strips trailing slashes from the base URL', () => {
    expect(
      resolveAgnesConfig({
        AGNES_BASE_URL: 'https://proxy.example.com/agnes/v1/',
        AGNES_TEXT_MODEL: 'custom-text',
        AGNES_IMAGE_MODEL: 'custom-image',
      }),
    ).toEqual({
      baseUrl: 'https://proxy.example.com/agnes/v1',
      textModel: 'custom-text',
      imageModel: 'custom-image',
    });
  });
});
