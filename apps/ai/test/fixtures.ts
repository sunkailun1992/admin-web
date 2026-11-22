// 单元测试与页面测试共用的接口数据（合成值，照 1.2.3 各用例的固定数据）。

export const requestId = '11111111-1111-4111-8111-111111111111';

export const modelSelection = () => ({
  provider: 'deepseek',
  model: 'synthetic-model',
  supportedProviders: ['deepseek', 'qwen'],
  updatedAt: '2026-11-10T12:00:00',
});

export const controlPlane = () => ({
  available: true,
  status: 'AVAILABLE',
  platformVersion: '1.108.4',
  consoleBaseUrl: 'https://gateway.example.invalid/prefix/ui/',
  checkedAt: '2026-11-11T00:00:00Z',
  modelCatalog: [
    {
      id: 'deployment-chat',
      modelName: 'synthetic-chat',
      provider: 'openai' as string | null,
      model: 'openai/synthetic-model' as string | null,
      capabilities: ['CHAT'],
      contextWindow: 8192,
      verificationStatus: 'NOT_CHECKED',
      apiKey: 'MUST_NOT_KEEP',
    },
    {
      id: 'deployment-ocr',
      modelName: 'synthetic-ocr',
      provider: null as string | null,
      model: null as string | null,
      capabilities: ['OCR'],
      verificationStatus: 'UNKNOWN',
    },
  ],
  taskBindings: [
    {
      taskCode: 'synthetic-index',
      taskName: '合成索引绑定',
      capability: 'EMBEDDING',
      modelName: 'synthetic-embedding',
      status: 'CONFIGURED',
      readOnly: true,
      reasonCode: 'RAG_INDEX_BOUND',
      apiKey: 'MUST_NOT_KEEP',
    },
  ],
  apiKey: 'MUST_NOT_KEEP',
});

/** LiteLLM 的别名：同一部署 id 的两个调用名称（1.2.3 tests/fixtures/model-control-plane-aliases.json）。 */
export const aliases = () => ({
  available: true,
  status: 'AVAILABLE',
  platformVersion: null,
  consoleBaseUrl: 'https://gateway.example.invalid/ui',
  checkedAt: '2026-11-11T00:00:00Z',
  modelCatalog: ['synthetic-language-default', 'synthetic-language-alias'].map(
    (modelName) => ({
      id: 'synthetic-shared-deployment',
      modelName,
      provider: 'openai',
      model: 'openai/synthetic-language-model',
      capabilities: ['CHAT'],
      contextWindow: 8192,
      verificationStatus: 'NOT_CHECKED',
      verifiedAt: null,
    }),
  ),
  taskBindings: [],
});

export type ProbeFixture = {
  requestId: string;
  checkedRevision: number;
  status: string;
  finishedAt: string | null;
  cleanupStatus: string;
};

export const config = () => ({
  id: 'config-1',
  platform: 'platform-1',
  name: '合成私有存储',
  provider: 'MINIO',
  endpoint: 'https://storage.example.invalid',
  bucket: 'synthetic-bucket',
  region: null as string | null,
  uploadEnabled: true,
  isDefault: true,
  version: 3,
  configRevision: 2,
  appliedRevision: 2 as number | null,
  runtimeStatus: 'APPLIED',
  credentialsConfigured: true,
  credentialUpdatedAt: null as string | null,
  referenceCount: 1,
  lastProbe: null as null | ProbeFixture,
});

export const settings = () => ({
  version: 1,
  defaultPlatform: 'platform-1' as string | null,
  legacyNullPlatform: 'legacy' as string | null,
  baseDir: 'files/',
  uploadTtlSeconds: 60,
  viewTtlSeconds: 1800,
  maxUploadBytes: 52428800,
  privateOnly: true,
});

export const capabilities = () => ({
  providers: [
    {
      code: 'MINIO',
      label: 'MinIO',
      availability: 'AVAILABLE',
      endpointRequired: true,
      regionRequired: false,
      reasonCode: null as string | null,
    },
  ],
  limits: {
    uploadTtlSeconds: { min: 60, max: 3600, defaultValue: 60 },
    viewTtlSeconds: { min: 60, max: 3600, defaultValue: 1800 },
    maxUploadBytes: { min: 1, max: 52428800, defaultValue: 52428800 },
  },
});

export const storageList = (
  items: Array<Record<string, unknown>> = [config()],
  page = 1,
  size = 20,
) => ({ items, page, size, total: items.length });

export const snapshot = () => ({
  list: storageList([
    config() as ReturnType<typeof config> & Record<string, unknown>,
  ]),
  settings: settings(),
  capabilities: capabilities(),
  defaultPlatforms: [{ platform: config().platform, name: config().name }],
});

export const operation = (status = 'SUCCEEDED', action = 'UPDATE') => ({
  requestId,
  action,
  configurationId: 'config-1' as string | null,
  status,
  checkedRevision: 2 as number | null,
  startedAt: null as string | null,
  finishedAt: null as string | null,
  failureCode: null as string | null,
  steps: [] as Array<{
    name: string;
    status: string;
    failureCode: string | null;
  }>,
  cleanupStatus: 'NOT_NEEDED',
  result: null as unknown,
});
