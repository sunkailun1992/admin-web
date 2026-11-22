import type { AxiosRequestConfig } from 'axios';
import { client } from '../http.ts';
import { strictData } from './envelope.ts';
import type {
  RequestOptions,
  StorageCreateBO,
  StorageListQuery,
  StorageSettingsBO,
  StorageUpdateBO,
} from './types.ts';

// 文件存储配置（后端 StorageConfigurationController，根路径 /api/ai）；返回值交给 storageModel 的解码器校验。
const ROOT = '/api/ai';
const INVALID = 'INVALID_STORAGE_RESPONSE';

async function storage(
  config: AxiosRequestConfig & { url: string },
  options: RequestOptions,
): Promise<unknown> {
  const response = await client.request<unknown>({
    ...config,
    url: `${ROOT}${config.url}`,
    signal: options.signal,
  });
  return strictData(response.data, INVALID);
}

const segment = (value: string) => encodeURIComponent(value);

export const listStorageConfigurations = (
  params: StorageListQuery,
  options: RequestOptions = {},
) =>
  storage({ method: 'GET', url: '/storage-configurations', params }, options);

export const getStorageCapabilities = (options: RequestOptions = {}) =>
  storage({ method: 'GET', url: '/storage-capabilities' }, options);

export const getStorageSettings = (options: RequestOptions = {}) =>
  storage({ method: 'GET', url: '/storage-settings' }, options);

export const createStorageConfiguration = (
  data: StorageCreateBO,
  options: RequestOptions = {},
) => storage({ method: 'POST', url: '/storage-configurations', data }, options);

export const updateStorageConfiguration = (
  id: string,
  data: StorageUpdateBO,
  options: RequestOptions = {},
) =>
  storage(
    { method: 'PUT', url: `/storage-configurations/${segment(id)}`, data },
    options,
  );

export const deleteStorageConfiguration = (
  id: string,
  params: { requestId: string; expectedVersion: number },
  options: RequestOptions = {},
) =>
  storage(
    { method: 'DELETE', url: `/storage-configurations/${segment(id)}`, params },
    options,
  );

export const updateStorageSettings = (
  data: StorageSettingsBO,
  options: RequestOptions = {},
) => storage({ method: 'PUT', url: '/storage-settings', data }, options);

export const probeStorageConfiguration = (
  id: string,
  data: { requestId: string; expectedVersion: number; mode: 'READ_WRITE' },
  options: RequestOptions = {},
) =>
  storage(
    {
      method: 'POST',
      url: `/storage-configurations/${segment(id)}/probes`,
      data,
    },
    options,
  );

export const getStorageOperation = (
  requestId: string,
  options: RequestOptions = {},
) =>
  storage(
    { method: 'GET', url: `/storage-operations/${segment(requestId)}` },
    options,
  );
