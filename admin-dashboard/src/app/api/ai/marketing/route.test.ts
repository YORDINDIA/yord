import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock('@/lib/ai/agnes', () => ({ generateText: h.generateText }));
vi.mock('@/lib/ai/guard', () => ({ assertAiAllowed: () => null }));
vi.mock('@/lib/utils/admin', () => ({
  requireAdmin: async () => ({
    user: { id: 'admin-1' },
    service: { from: vi.fn() },
  }),
}));

const originalKey = process.env.AGNES_AI_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.AGNES_AI_API_KEY;
  else process.env.AGNES_AI_API_KEY = originalKey;
});

describe('marketing AI route configuration', () => {
  it('returns NOT_CONFIGURED when the Agnes key is absent', async () => {
    delete process.env.AGNES_AI_API_KEY;
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/ai/marketing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief: 'Summer launch' }),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: 'NOT_CONFIGURED',
      message: 'AI service not configured',
    });
    expect(h.generateText).not.toHaveBeenCalled();
  });
});
