import OpenAI from 'openai';
import { getCompletionText } from './parse';

/**
 * Agnes AI transport for the admin AI routes (listing, blog, marketing, image).
 *
 * The `openai` package is used here purely as an HTTP client pointed at the
 * Agnes API hub. Text goes through Chat Completions
 * (`agnes-3.0-flash`). Images go through `POST /v1/images/generations`, which is
 * called with raw `fetch` in the route: the API expects a literal `extra_body`
 * object, and the SDK merges `extra_body` into the request body instead of
 * sending the key — `response_format` and `image` at the top level are an error.
 */

/** Environment keys this module reads. */
export interface AgnesEnv {
  AGNES_AI_API_KEY?: string;
  AGNES_BASE_URL?: string;
  AGNES_TEXT_MODEL?: string;
  AGNES_IMAGE_MODEL?: string;
}

/** Resolve the Agnes endpoints/models, defaulting to the public API hub. */
export function resolveAgnesConfig(env: AgnesEnv = process.env as AgnesEnv) {
  return {
    baseUrl: (env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/+$/, ''),
    textModel: env.AGNES_TEXT_MODEL || 'agnes-3.0-flash',
    imageModel: env.AGNES_IMAGE_MODEL || 'agnes-image-2.5-flash',
  };
}

const config = resolveAgnesConfig();

export const agnesBaseUrl = config.baseUrl;
export const textModel = config.textModel;
export const imageModel = config.imageModel;

let client: OpenAI | null = null;

/**
 * Lazily built so importing this module (the image route, unit tests) never
 * requires a key; a missing key surfaces as a route error instead of an
 * import-time throw.
 */
function agnesClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.AGNES_AI_API_KEY;
    if (!apiKey) throw new Error('AGNES_AI_API_KEY is not set');
    client = new OpenAI({ apiKey, baseURL: agnesBaseUrl });
  }
  return client;
}

/** One-shot text generation. Returns '' when the model returned no content. */
export async function generateText(prompt: string): Promise<string> {
  const response = await agnesClient().chat.completions.create({
    model: textModel,
    messages: [{ role: 'user', content: prompt }],
  });
  return getCompletionText(response);
}

/**
 * Image tier for generated product covers: 1K / 1:1 is 1024x1024, matching the
 * previous provider's output and the PNG stored under `ai/` in R2.
 */
export const IMAGE_SIZE = '1K';
export const IMAGE_RATIO = '1:1';

/**
 * Request body for an image edit (image-to-image). The source URL is handed to
 * Agnes, which fetches it, so it must already be publicly reachable — the route
 * checks it against the import allowlist before calling this.
 *
 * `response_format` and `image` MUST sit under `extra_body`; the API rejects
 * them at the top level. `b64_json` is verified to work for edit mode, so no
 * second download of the generated image is needed.
 */
export function buildImageEditBody(prompt: string, imageUrl: string) {
  return {
    model: imageModel,
    prompt,
    size: IMAGE_SIZE,
    ratio: IMAGE_RATIO,
    extra_body: {
      response_format: 'b64_json' as const,
      image: [imageUrl],
    },
  };
}
