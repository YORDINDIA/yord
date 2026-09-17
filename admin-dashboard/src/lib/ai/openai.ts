import OpenAI from 'openai';

export const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
export const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});
