// 知识库（rag 服务）的接口类型，照 1.2.4 的 src/services/rag/types.d.ts（RagAPI 命名空间）。

export type SourceType =
  'xlsx' | 'docx' | 'pdf' | 'png' | 'jpg' | 'jpeg' | 'txt' | (string & {});

export type OcrCapabilities = {
  textRecognition?: boolean;
  tableStructure?: boolean;
  layoutAnalysis?: boolean;
};

export type SourceMetadata = {
  page?: number;
  block_type?: string;
  bbox?: [number, number, number, number] | null;
  ocr_capabilities?: OcrCapabilities;
};

export type DocumentValidationVO = {
  valid: boolean;
  expectedChunkCount: number;
  storedPointCount: number;
  validPointCount: number;
  invalidContentHashCount: number;
  invalidDimensionCount: number;
};

export type DocumentStatus =
  'STAGING' | 'ACTIVE' | 'SUPERSEDED' | 'FAILED' | 'DELETED' | (string & {});

export type DocumentVO = {
  documentId: string;
  knowledgeBase: string;
  documentCode: string;
  title: string;
  sourceName: string;
  sourceType: SourceType;
  documentVersion: number;
  status: DocumentStatus;
  chunkCount: number;
  duplicateChunkCount: number;
  fileFingerprint: string;
  ingestedAt: string;
};

export type DocumentIngestionVO = {
  document: DocumentVO;
  idempotent: boolean;
  validation: DocumentValidationVO;
  graphBuild?: KnowledgeGraphSyncVO;
  graphStatus?: GraphBuildStatus | (string & {});
};

export type DocumentChunkVO = {
  chunkId: string;
  chunkIndex: number;
  chunkType: string;
  sectionPath?: string;
  sourceName?: string;
  sourceLocator?: string;
  content: string;
  sourceMetadata?: SourceMetadata;
  duplicateLocators?: string[];
};

export type DocumentChunkPageVO = {
  documentId: string;
  items: DocumentChunkVO[];
  nextCursor?: string | null;
};

export type RetrievalRequest = {
  query: string;
  collectionName?: string;
  topK?: number;
  similarityThreshold?: number;
  maxContextCharacters?: number;
};

export type RetrievalChunkVO = {
  documentId: string;
  chunkId: string;
  title: string;
  source: string;
  content: string;
  score: number;
};

export type RetrievalVO = {
  enabled: boolean;
  matched: boolean;
  context: string;
  sourceCount: number;
  message: string;
  chunks: RetrievalChunkVO[];
};

export type GraphNodeType =
  'DOCUMENT' | 'SECTION' | 'RECORD' | 'CONCEPT' | 'ENTITY';

export type GraphRelationType =
  'CONTAINS' | 'HAS_ATTRIBUTE' | 'MENTIONS' | 'RELATED_TO';

export type GraphViewMode = 'OVERVIEW' | 'DETAIL';

export type KnowledgeGraphQuery = {
  knowledgeBase?: string;
  query?: string;
  nodeType?: GraphNodeType;
  viewMode?: GraphViewMode;
  limit?: number;
};

export type KnowledgeGraphSource = {
  pointId: string;
  documentId: string;
  documentCode: string;
  documentVersion: number;
  documentRevision: number;
  chunkId: string;
  contentSha256: string;
  sourceName?: string;
  sourceType?: SourceType;
  sourceLocator?: string;
  chunkType?: string;
  sectionPath?: string;
  sourceMetadata?: SourceMetadata;
  evidence?: string;
  evidenceTruncated?: boolean;
  evidenceNormalized?: boolean;
};

export type KnowledgeGraphNodeProperties = {
  sourceName?: string;
  sourceType?: SourceType;
  sourceMetadata?: SourceMetadata;
  chunkId?: string;
  chunkType?: string;
  sectionPath?: string;
  sources?: KnowledgeGraphSource[];
  sourceCount?: number;
  sourceTruncated?: boolean;
  [key: string]: unknown;
};

export type KnowledgeGraphNodeVO = {
  id: string;
  type: GraphNodeType;
  name: string;
  label?: string;
  documentId?: string;
  documentCode?: string;
  documentVersion?: number;
  sourceLocator?: string;
  properties?: KnowledgeGraphNodeProperties;
};

export type KnowledgeGraphEdgeVO = {
  id: string;
  source: string;
  target: string;
  type: GraphRelationType;
  label?: string;
  sourceLocator?: string;
  properties?: KnowledgeGraphNodeProperties;
};

export type GraphBuildStatus =
  'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export type GraphBuild = {
  buildId: string;
  knowledgeBase: string;
  status: GraphBuildStatus;
  documentCount: number;
  processedDocumentCount: number;
  nodeCount: number;
  edgeCount: number;
  errorCode?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeGraphVO = {
  knowledgeBase: string;
  viewMode: GraphViewMode;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  nodeTypeCounts: Record<string, number>;
  relationTypeCounts: Record<string, number>;
  nodes: KnowledgeGraphNodeVO[];
  edges: KnowledgeGraphEdgeVO[];
  backend?: 'neo4j';
  build?: GraphBuild | null;
};

export type KnowledgeGraphSyncVO = {
  knowledgeBase: string;
  documentCount: number;
  nodeCount: number;
  edgeCount: number;
  buildId?: string;
  status?: GraphBuildStatus;
};
