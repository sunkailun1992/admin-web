import { AI_SERVICE_PREFIX } from '@/constants/auth';
import { request } from '@umijs/max';
import type { AiRequestOptions } from './index';

const root = `${AI_SERVICE_PREFIX}/api/ai`;
async function storageRequest<T>(path: string, options: AiRequestOptions) {
  const response = (await request<API.ApiResponse<T>>(
    `${root}${path}`,
    options,
  )) as unknown as API.ApiResponse<T>;
  if (response?.success !== true) throw new Error('INVALID_STORAGE_RESPONSE');
  return response.data;
}
export const listStorageConfigurations = (
  query: AiAPI.StorageListQuery,
  options?: AiRequestOptions,
) =>
  storageRequest<AiAPI.StorageList>('/storage-configurations', {
    ...options,
    method: 'GET',
    params: query,
  });
export const getStorageCapabilities = (options?: AiRequestOptions) =>
  storageRequest<AiAPI.StorageCapabilitiesVO>('/storage-capabilities', {
    ...options,
    method: 'GET',
  });
export const getStorageSettings = (options?: AiRequestOptions) =>
  storageRequest<AiAPI.StorageSettingsVO>('/storage-settings', {
    ...options,
    method: 'GET',
  });
export const createStorageConfiguration = (
  data: AiAPI.StorageCreateBO,
  options?: AiRequestOptions,
) =>
  storageRequest<AiAPI.StorageOperationVO>('/storage-configurations', {
    ...options,
    method: 'POST',
    data,
  });
export const updateStorageConfiguration = (
  id: string,
  data: AiAPI.StorageUpdateBO,
  options?: AiRequestOptions,
) =>
  storageRequest<AiAPI.StorageOperationVO>(
    `/storage-configurations/${encodeURIComponent(id)}`,
    { ...options, method: 'PUT', data },
  );
export const deleteStorageConfiguration = (
  id: string,
  params: { requestId: string; expectedVersion: number },
  options?: AiRequestOptions,
) =>
  storageRequest<AiAPI.StorageOperationVO>(
    `/storage-configurations/${encodeURIComponent(id)}`,
    { ...options, method: 'DELETE', params },
  );
export const updateStorageSettings = (
  data: AiAPI.StorageSettingsBO,
  options?: AiRequestOptions,
) =>
  storageRequest<AiAPI.StorageOperationVO>('/storage-settings', {
    ...options,
    method: 'PUT',
    data,
  });
export const probeStorageConfiguration = (
  id: string,
  data: { requestId: string; expectedVersion: number; mode: 'READ_WRITE' },
  options?: AiRequestOptions,
) =>
  storageRequest<AiAPI.StorageOperationVO>(
    `/storage-configurations/${encodeURIComponent(id)}/probes`,
    { ...options, method: 'POST', data },
  );
export const getStorageOperation = (
  requestId: string,
  options?: AiRequestOptions,
) =>
  storageRequest<AiAPI.StorageOperationVO>(
    `/storage-operations/${encodeURIComponent(requestId)}`,
    { ...options, method: 'GET' },
  );
