// AI 服务与统一配置的接口类型，照 1.2.4 的 src/services/ai/types.d.ts（AiAPI 命名空间）与后端 ai 服务的 VO。

export type ModelProvider = 'google' | 'deepseek' | 'qwen' | (string & {});

export type ModelSelectionVO = {
  provider: ModelProvider;
  model?: string;
  supportedProviders?: ModelProvider[];
  updatedAt?: string;
};

export type ModelSelectionUpdateBO = { provider: ModelProvider };

export type ModelCapability =
  | 'CHAT'
  | 'EMBEDDING'
  | 'RERANK'
  | 'OCR'
  | 'AUDIO_TRANSCRIPTION'
  | 'AUDIO_SPEECH'
  | 'IMAGE'
  | 'VIDEO'
  | 'OTHER';

export type ModelVerification =
  'NOT_CHECKED' | 'VERIFIED' | 'FAILED' | 'UNKNOWN';

export type ModelCatalogItem = {
  id: string;
  modelName: string;
  provider: string | null;
  model: string | null;
  capabilities: ModelCapability[];
  contextWindow: number | null;
  verificationStatus: ModelVerification;
  verifiedAt: string | null;
};

export type ModelTaskBinding = {
  taskCode: string;
  taskName: string;
  capability: ModelCapability;
  modelName: string | null;
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'NOT_INTEGRATED';
  readOnly: boolean;
  reasonCode: 'RAG_INDEX_BOUND' | 'BUSINESS_MANAGED' | 'NOT_INTEGRATED' | null;
};

export type ModelControlPlaneVO = {
  available: boolean;
  status: 'AVAILABLE' | 'NOT_CONFIGURED' | 'UNREACHABLE';
  platformVersion: string | null;
  consoleBaseUrl: string | null;
  checkedAt: string | null;
  modelCatalog: ModelCatalogItem[];
  taskBindings: ModelTaskBinding[];
};

export type StorageProvider =
  'MINIO' | 'ALIYUN_OSS' | 'TENCENT_COS' | 'S3_COMPATIBLE';

export type StorageOperationStatus =
  'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

export type StorageCleanupStatus =
  'NOT_NEEDED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

export type StorageAction =
  'CREATE' | 'UPDATE' | 'DELETE' | 'UPDATE_SETTINGS' | 'PROBE';

export type StorageProbeSummary = {
  requestId: string;
  checkedRevision: number;
  finishedAt: string | null;
  status: StorageOperationStatus;
  cleanupStatus: StorageCleanupStatus;
};

export type StorageConfigurationVO = {
  id: string;
  platform: string;
  name: string;
  provider: StorageProvider;
  endpoint: string;
  bucket: string;
  region: string | null;
  uploadEnabled: boolean;
  isDefault: boolean;
  version: number;
  configRevision: number;
  appliedRevision: number | null;
  runtimeStatus: 'UNCONFIGURED' | 'APPLIED' | 'APPLY_FAILED';
  credentialsConfigured: boolean;
  credentialUpdatedAt: string | null;
  referenceCount: number;
  lastProbe: StorageProbeSummary | null;
};

export type StorageSettingsVO = {
  version: number;
  defaultPlatform: string | null;
  legacyNullPlatform: string | null;
  baseDir: string;
  uploadTtlSeconds: number;
  viewTtlSeconds: number;
  maxUploadBytes: number;
  privateOnly: true;
};

export type StorageLimit = { min: number; max: number; defaultValue: number };

export type StorageProviderCapability = {
  code: StorageProvider;
  label: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  endpointRequired: boolean;
  regionRequired: boolean;
  reasonCode: string | null;
};

export type StorageCapabilitiesVO = {
  providers: StorageProviderCapability[];
  limits: {
    uploadTtlSeconds: StorageLimit;
    viewTtlSeconds: StorageLimit;
    maxUploadBytes: StorageLimit;
  };
};

export type StorageList = {
  items: StorageConfigurationVO[];
  page: number;
  size: number;
  total: number;
};

export type StorageListQuery = {
  page: number;
  size: number;
  search?: string;
  provider?: StorageProvider;
  uploadEnabled?: boolean;
};

export type StorageStepName =
  'WRITE' | 'EXISTS' | 'READ' | 'VERIFY_PRIVATE' | 'CLEANUP';

export type StorageStepStatus =
  'NOT_STARTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'SKIPPED';

export type StorageOperationVO = {
  requestId: string;
  action: StorageAction;
  configurationId: string | null;
  status: StorageOperationStatus;
  checkedRevision: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  failureCode: string | null;
  steps: Array<{
    name: StorageStepName;
    status: StorageStepStatus;
    failureCode: string | null;
  }>;
  cleanupStatus: StorageCleanupStatus;
  result: StorageConfigurationVO | StorageSettingsVO | null;
};

export type StorageCreateBO = {
  requestId: string;
  name: string;
  provider: StorageProvider;
  endpoint?: string;
  bucket: string;
  region?: string;
  uploadEnabled: boolean;
  credentialAction: 'REPLACE';
  accessKeyId: string;
  secretKey: string;
};

export type StorageUpdateBO = {
  requestId: string;
  expectedVersion: number;
  name: string;
  uploadEnabled: boolean;
  credentialAction: 'KEEP' | 'REPLACE';
  accessKeyId?: string;
  secretKey?: string;
};

export type StorageSettingsBO = {
  requestId: string;
  expectedSettingsVersion: number;
  defaultPlatform: string | null;
  uploadTtlSeconds: number;
  viewTtlSeconds: number;
  maxUploadBytes: number;
};

/** 读请求可取消：调用方传入 AbortSignal（控制器与 TanStack Query 的 queryFn 都给）。 */
export type RequestOptions = { signal?: AbortSignal };
