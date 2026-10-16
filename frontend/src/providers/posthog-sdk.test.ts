import { beforeEach, describe, expect, it, vi } from 'vitest';

const { posthog } = vi.hoisted(() => ({
  posthog: { init: vi.fn() },
}));

vi.mock('posthog-js', () => ({ default: posthog }));

describe('PostHog session recording', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://posthog.example.com');
    posthog.init.mockClear();
  });

  it('enables recording while masking all input values', async () => {
    const { loadPostHog } = await import('./posthog-sdk');

    await loadPostHog();

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        advanced_disable_feature_flags: true,
        session_recording: { maskAllInputs: true },
      }),
    );
  });
});
