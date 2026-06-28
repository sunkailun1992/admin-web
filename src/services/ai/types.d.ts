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
}
