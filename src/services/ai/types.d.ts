declare namespace AiAPI {
  type ModelProvider = 'google' | 'deepseek' | 'qwen';

  interface ModelSelectionVO {
    provider: ModelProvider;
    model?: string;
    supportedProviders?: ModelProvider[];
    updatedAt?: string;
  }

  interface ModelSelectionUpdateBO {
    provider: ModelProvider;
  }

  type ModelCapability =
    | 'CHAT'
    | 'EMBEDDING'
    | 'RERANK'
    | 'OCR'
    | 'AUDIO_TRANSCRIPTION'
    | 'AUDIO_SPEECH'
    | 'IMAGE'
    | 'VIDEO'
    | 'OTHER';
  type ModelVerification = 'NOT_CHECKED' | 'VERIFIED' | 'FAILED' | 'UNKNOWN';
  interface ModelCatalogItem {
    id: string;
    modelName: string;
    provider: string | null;
    model: string | null;
    capabilities: ModelCapability[];
    contextWindow: number | null;
    verificationStatus: ModelVerification;
    verifiedAt: string | null;
  }
  interface ModelTaskBinding {
    taskCode: string;
    taskName: string;
    capability: ModelCapability;
    modelName: string | null;
    status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'NOT_INTEGRATED';
    readOnly: boolean;
    reasonCode:
      | 'RAG_INDEX_BOUND'
      | 'BUSINESS_MANAGED'
      | 'NOT_INTEGRATED'
      | null;
  }
  interface ModelControlPlaneVO {
    available: boolean;
    status: 'AVAILABLE' | 'NOT_CONFIGURED' | 'UNREACHABLE';
    platformVersion: string | null;
    consoleBaseUrl: string | null;
    checkedAt: string | null;
    modelCatalog: ModelCatalogItem[];
    taskBindings: ModelTaskBinding[];
  }

  type StorageProvider =
    | 'MINIO'
    | 'ALIYUN_OSS'
    | 'TENCENT_COS'
    | 'S3_COMPATIBLE';
  type StorageOperationStatus =
    | 'PENDING'
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'UNKNOWN';
  type StorageCleanupStatus =
    | 'NOT_NEEDED'
    | 'PENDING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'UNKNOWN';
  type StorageAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'UPDATE_SETTINGS'
    | 'PROBE';
  interface StorageProbeSummary {
    requestId: string;
    checkedRevision: number;
    finishedAt: string | null;
    status: StorageOperationStatus;
    cleanupStatus: StorageCleanupStatus;
  }
  interface StorageConfigurationVO {
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
  }
  interface StorageSettingsVO {
    version: number;
    defaultPlatform: string | null;
    legacyNullPlatform: string | null;
    baseDir: string;
    uploadTtlSeconds: number;
    viewTtlSeconds: number;
    maxUploadBytes: number;
    privateOnly: true;
  }
  interface StorageLimit {
    min: number;
    max: number;
    defaultValue: number;
  }
  interface StorageCapabilitiesVO {
    providers: {
      code: StorageProvider;
      label: string;
      availability: 'AVAILABLE' | 'UNAVAILABLE';
      endpointRequired: boolean;
      regionRequired: boolean;
      reasonCode: string | null;
    }[];
    limits: {
      uploadTtlSeconds: StorageLimit;
      viewTtlSeconds: StorageLimit;
      maxUploadBytes: StorageLimit;
    };
  }
  interface StorageList {
    items: StorageConfigurationVO[];
    page: number;
    size: number;
    total: number;
  }
  interface StorageListQuery {
    page?: number;
    size?: number;
    search?: string;
    provider?: StorageProvider;
    uploadEnabled?: boolean;
  }
  interface StorageOperationVO {
    requestId: string;
    action: StorageAction;
    configurationId: string | null;
    status: StorageOperationStatus;
    checkedRevision: number | null;
    startedAt: string | null;
    finishedAt: string | null;
    failureCode: string | null;
    steps: {
      name: 'WRITE' | 'EXISTS' | 'READ' | 'VERIFY_PRIVATE' | 'CLEANUP';
      status:
        | 'NOT_STARTED'
        | 'RUNNING'
        | 'SUCCEEDED'
        | 'FAILED'
        | 'UNKNOWN'
        | 'SKIPPED';
      failureCode: string | null;
    }[];
    cleanupStatus: StorageCleanupStatus;
    result: StorageConfigurationVO | StorageSettingsVO | null;
  }
  interface StorageCreateBO {
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
  }
  interface StorageUpdateBO {
    requestId: string;
    expectedVersion: number;
    name: string;
    uploadEnabled: boolean;
    credentialAction: 'KEEP' | 'REPLACE';
    accessKeyId?: string;
    secretKey?: string;
  }
  interface StorageSettingsBO {
    requestId: string;
    expectedSettingsVersion: number;
    defaultPlatform: string | null;
    uploadTtlSeconds: number;
    viewTtlSeconds: number;
    maxUploadBytes: number;
  }
}
