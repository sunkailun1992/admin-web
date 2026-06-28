import { AI_SERVICE_PREFIX } from '@/constants/auth';
import type { AxiosRequestConfig } from '@umijs/max';
import { request } from '@umijs/max';

type AiRequestOptions = AxiosRequestConfig & { skipErrorHandler?: boolean };

function aiRequest<T>(url: string, options?: AiRequestOptions): Promise<T> {
  const requestUrl = `${AI_SERVICE_PREFIX}${url}`;
  return options
    ? (request<T>(requestUrl, options) as unknown as Promise<T>)
    : (request<T>(requestUrl) as unknown as Promise<T>);
}

export async function getAiModelSelection() {
  return aiRequest<AiAPI.ModelSelectionVO>('/api/ai/model-selection');
}

export async function updateAiModelSelection(data: AiAPI.ModelSelectionUpdateBO) {
  return aiRequest<AiAPI.ModelSelectionVO>('/api/ai/model-selection', {
    method: 'PUT',
    data,
  });
}
