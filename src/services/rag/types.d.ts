declare namespace RagAPI {
  type SourceType =
    | 'xlsx'
    | 'docx'
    | 'pdf'
    | 'png'
    | 'jpg'
    | 'jpeg'
    | 'txt'
    | (string & {});

  type OcrCapabilities = {
    textRecognition?: boolean;
    tableStructure?: boolean;
    layoutAnalysis?: boolean;
  };

  type SourceMetadata = {
    page?: number;
    block_type?: string;
    bbox?: [number, number, number, number] | null;
    ocr_capabilities?: OcrCapabilities;
  };

  type DocumentValidationVO = {
    valid: boolean;
    expectedChunkCount: number;
    storedPointCount: number;
    validPointCount: number;
    invalidContentHashCount: number;
    invalidDimensionCount: number;
  };

  type DocumentVO = {
    documentId: string;
    knowledgeBase: string;
    documentCode: string;
    title: string;
    sourceName: string;
    sourceType: SourceType;
    documentVersion: number;
    status: 'STAGING' | 'ACTIVE' | 'SUPERSEDED' | 'FAILED' | 'DELETED' | string;
    chunkCount: number;
    duplicateChunkCount: number;
    fileFingerprint: string;
    ingestedAt: string;
  };

  type DocumentIngestionVO = {
    document: DocumentVO;
    idempotent: boolean;
    validation: DocumentValidationVO;
  };

  type DocumentChunkVO = {
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

  type DocumentChunkPageVO = {
    documentId: string;
    items: DocumentChunkVO[];
    nextCursor?: string | null;
  };

  type RetrievalRequest = {
    query: string;
    collectionName?: string;
    topK?: number;
    similarityThreshold?: number;
    maxContextCharacters?: number;
  };

  type RetrievalChunkVO = {
    documentId: string;
    chunkId: string;
    title: string;
    source: string;
    content: string;
    score: number;
  };

  type RetrievalVO = {
    enabled: boolean;
    matched: boolean;
    context: string;
    sourceCount: number;
    message: string;
    chunks: RetrievalChunkVO[];
  };

  type GraphNodeType = 'DOCUMENT' | 'SECTION' | 'RECORD' | 'CONCEPT';

  type GraphRelationType = 'CONTAINS' | 'HAS_ATTRIBUTE' | 'MENTIONS';

  type GraphViewMode = 'OVERVIEW' | 'DETAIL';

  type KnowledgeGraphQuery = {
    knowledgeBase?: string;
    query?: string;
    nodeType?: GraphNodeType;
    viewMode?: GraphViewMode;
    limit?: number;
  };

  type KnowledgeGraphNodeProperties = {
    sourceName?: string;
    sourceType?: SourceType;
    sourceMetadata?: SourceMetadata;
    chunkId?: string;
    chunkType?: string;
    sectionPath?: string;
    [key: string]: unknown;
  };

  type KnowledgeGraphNodeVO = {
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

  type KnowledgeGraphEdgeVO = {
    id: string;
    source: string;
    target: string;
    type: GraphRelationType;
    label?: string;
    sourceLocator?: string;
    properties?: Record<string, unknown>;
  };

  type KnowledgeGraphVO = {
    knowledgeBase: string;
    viewMode: GraphViewMode;
    nodeCount: number;
    edgeCount: number;
    truncated: boolean;
    nodeTypeCounts: Record<string, number>;
    relationTypeCounts: Record<string, number>;
    nodes: KnowledgeGraphNodeVO[];
    edges: KnowledgeGraphEdgeVO[];
  };

  type KnowledgeGraphSyncVO = {
    knowledgeBase: string;
    documentCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}
