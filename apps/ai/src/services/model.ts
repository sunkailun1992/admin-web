import { client } from '../http.ts';
import type { ModelSelectionUpdateBO, RequestOptions } from './types.ts';

// 后端 AiModelSelectionController 直接返回 AiModelSelectionResponse（不包响应外壳）；
// 返回值按未经信任的数据交给 decodeModelSelection 校验。
const MODEL_SELECTION_URL = '/api/ai/model-selection';

export async function getModelSelection(
  options: RequestOptions = {},
): Promise<unknown> {
  return (
    await client.get<unknown>(MODEL_SELECTION_URL, { signal: options.signal })
  ).data;
}

export async function updateModelSelection(
  body: ModelSelectionUpdateBO,
  options: RequestOptions = {},
): Promise<unknown> {
  return (
    await client.put<unknown>(MODEL_SELECTION_URL, body, {
      signal: options.signal,
    })
  ).data;
}
