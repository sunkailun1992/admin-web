import { expect, test } from 'vitest';
import { loadWithMocks } from '../support/loadWithMocks';

type AiService = typeof import('@/services/ai');
type RequestOptions = {
  signal?: AbortSignal;
  skipAuth?: unknown;
  headers?: unknown;
  method?: string;
  data?: unknown;
};

test('model metadata GET and PUT preserve gateway path, body and cancellation without tenant spoofing', async () => {
  const calls: Array<{ url: string; options: RequestOptions }> = [];
  const service = await loadWithMocks<AiService>('@/services/ai', {
    '@umijs/max': {
      request: async (url: string, options: RequestOptions = {}) => {
        calls.push({ url, options });
        return {};
      },
    },
  });
  const signal = new AbortController().signal;
  await service.getAiModelSelection({ signal });
  await service.updateAiModelSelection({ provider: 'qwen' }, { signal });
  expect(calls.length).toBe(2);
  for (const call of calls) {
    expect(call.url).toBe('/api/ai/model-selection');
    expect(call.options.signal).toBe(signal);
    expect(call.options.skipAuth).toBe(undefined);
    expect(call.options.headers).toBe(undefined);
  }
  expect(calls[0].options.method || 'GET').toBe('GET');
  expect(calls[1].options.method).toBe('PUT');
  expect(JSON.stringify(calls[1].options.data)).toBe('{"provider":"qwen"}');
});
