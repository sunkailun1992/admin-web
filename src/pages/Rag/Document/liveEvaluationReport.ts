import type { EvaluationDetail, EvaluationReport } from './evaluationReport';
import { MAX_EVALUATION_REPORT_BYTES } from './evaluationReport';

export const LIVE_CHECK_LABELS = {
  completeResponses: '响应完整',
  noScopeLeaks: '没有跨租户或知识库命中',
  knownSources: '来源均在语料中',
  correctEmptyResponses: '负例均正确返回空结果',
  allReranksCompleted: '重排均完成',
  expectedRetrievalMode: '检索模式符合预期',
  hybridRecallNoRegression: 'Hybrid Recall 无回退',
  hybridMrrNoRegression: 'Hybrid MRR 无回退',
  hybridNdcgNoRegression: 'Hybrid nDCG 无回退',
  temporaryCollectionRemoved: '临时集合已确认删除',
  runCompleted: '评估执行完成',
};
const SCORES = ['recallAtK', 'mrrAtK', 'ndcgAtK'] as const;
const DELTAS = [...SCORES, 'latencyP50Ms', 'latencyP95Ms'] as const;
const COUNTS = [
  'questionCount',
  'positiveCount',
  'negativeCount',
  'falseNegativeCount',
  'falsePositiveCount',
  'correctEmptyCount',
  'errorCount',
  'missingPredictionCount',
  'scopeLeakCount',
  'unknownSourceCount',
  'latencySampleCount',
  'degradedCount',
  'timeoutCount',
  'blockedScopeViolationCount',
  'modeMismatchCount',
] as const;
type Metrics = Omit<EvaluationReport, 'provenance' | 'gate'> & {
  degradedCount: number;
  timeoutCount: number;
  blockedScopeViolationCount: number;
  modeMismatchCount: number;
  errorCodes: Record<string, number>;
};
type Summary = Omit<Metrics, 'details'>;
export type LiveEvaluationReport = {
  kind: 'live-comparison';
  status: 'completed' | 'failed';
  startedAt: string;
  finishedAt: string;
  results: { dense: Summary; hybrid: Summary };
  hybridMinusDense: Record<(typeof DELTAS)[number], number | null>;
  acceptance: {
    passed: boolean;
    checks: Record<keyof typeof LIVE_CHECK_LABELS, boolean>;
  };
  cleanup: {
    required: boolean;
    attempted: boolean;
    verifiedAbsent: boolean;
    deleteStatus?: number;
    readbackStatus?: number;
    errorCode?: string;
  };
  errorCode?: string;
};

function valid(condition: unknown): asserts condition {
  if (!condition)
    throw new Error(
      '比较报告格式或统计不一致，请选择 live_compare 生成的完整 schemaVersion=1 报告。',
    );
}
function object(value: unknown): Record<string, unknown> {
  valid(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function shape(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const row = object(value);
  valid(
    required.every((key) => Object.prototype.hasOwnProperty.call(row, key)) &&
      Object.keys(row).every(
        (key) => required.includes(key) || optional.includes(key),
      ),
  );
  return row;
}
function finite(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
function count(value: unknown, max = 10000): value is number {
  return Number.isSafeInteger(value) && finite(value, 0, max);
}
function text(value: unknown, max = 256): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}
function errorCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(value);
}
function close(actual: number | null, expected: number | null) {
  return actual === null || expected === null
    ? actual === expected
    : Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected));
}
function average(
  rows: EvaluationDetail[],
  key: 'recall' | 'reciprocalRank' | 'ndcg',
) {
  return rows.length
    ? rows.reduce((sum, row) => sum + row[key]!, 0) / rows.length
    : null;
}
function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  return (
    sorted[Math.floor(index)] +
    (sorted[Math.ceil(index)] - sorted[Math.floor(index)]) * (index % 1)
  );
}

// 独立校验 live_compare 的指标对象；不伪造旧格式的 provenance 或逐模式 gate。
function metrics(value: unknown): Metrics {
  const row = shape(
    value,
    ['schemaVersion', 'k', ...COUNTS, ...DELTAS, 'details', 'errorCodes'],
    ['topScoreDistribution'],
  );
  valid(row.schemaVersion === 1 && count(row.k, 1000) && row.k > 0);
  COUNTS.forEach((key) =>
    valid(
      count(
        row[key],
        key === 'unknownSourceCount' ? Number.MAX_SAFE_INTEGER : 10000,
      ),
    ),
  );
  DELTAS.forEach((key) =>
    valid(
      row[key] === null ||
        finite(
          row[key],
          0,
          SCORES.includes(key as (typeof SCORES)[number])
            ? 1
            : Number.MAX_SAFE_INTEGER,
        ),
    ),
  );
  valid(Array.isArray(row.details) && row.details.length === row.questionCount);
  const ids = new Set<string>();
  row.details.forEach((item) => {
    const positive = Object.prototype.hasOwnProperty.call(
      object(item),
      'recall',
    );
    const detail = shape(item, [
      'id',
      'failed',
      'scopeLeak',
      'retrievedSourceIds',
      'latencyMs',
      ...(positive ? ['recall', 'reciprocalRank', 'ndcg'] : ['correctEmpty']),
    ]);
    valid(text(detail.id) && !ids.has(detail.id));
    ids.add(detail.id);
    valid(
      typeof detail.failed === 'boolean' &&
        typeof detail.scopeLeak === 'boolean',
    );
    valid(detail.latencyMs === null || finite(detail.latencyMs));
    valid(
      Array.isArray(detail.retrievedSourceIds) &&
        detail.retrievedSourceIds.length <= 1000 &&
        detail.retrievedSourceIds.every((id) => text(id)),
    );
    if (positive)
      ['recall', 'reciprocalRank', 'ndcg'].forEach((key) =>
        valid(finite(detail[key], 0, 1)),
      );
    else
      valid(
        typeof detail.correctEmpty === 'boolean' &&
          detail.correctEmpty ===
            (!detail.failed && detail.retrievedSourceIds.length === 0),
      );
  });
  const errors = object(row.errorCodes);
  Object.entries(errors).forEach(([key, value]) =>
    valid(errorCode(key) && count(value) && value > 0),
  );
  const result = row as unknown as Metrics;
  const positive = result.details.filter((item) => item.recall !== undefined);
  const negative = result.details.filter(
    (item) => item.correctEmpty !== undefined,
  );
  const latencies = result.details.flatMap((item) =>
    item.latencyMs === null ? [] : [item.latencyMs],
  );
  valid(
    result.positiveCount === positive.length &&
      result.negativeCount === negative.length &&
      result.questionCount === result.positiveCount + result.negativeCount &&
      result.errorCount ===
        result.details.filter((item) => item.failed).length &&
      result.scopeLeakCount ===
        result.details.filter((item) => item.scopeLeak).length &&
      result.correctEmptyCount ===
        negative.filter((item) => item.correctEmpty).length &&
      result.falseNegativeCount ===
        positive.filter((item) => item.recall === 0).length &&
      result.falsePositiveCount ===
        negative.filter(
          (item) => !item.failed && item.retrievedSourceIds.length > 0,
        ).length &&
      result.latencySampleCount === latencies.length &&
      result.missingPredictionCount <= result.errorCount &&
      result.degradedCount + result.errorCount <= result.questionCount &&
      result.modeMismatchCount + result.errorCount <= result.questionCount &&
      result.timeoutCount === (errors.RETRIEVAL_TIMEOUT || 0) &&
      result.blockedScopeViolationCount ===
        (errors.TENANT_ISOLATION_VIOLATION || 0) &&
      Object.values(errors).reduce<number>(
        (sum, value) => sum + Number(value),
        0,
      ) ===
        result.errorCount - result.missingPredictionCount,
  );
  valid(
    close(result.recallAtK, average(positive, 'recall')) &&
      close(result.mrrAtK, average(positive, 'reciprocalRank')) &&
      close(result.ndcgAtK, average(positive, 'ndcg')) &&
      close(result.latencyP50Ms, percentile(latencies, 0.5)) &&
      close(result.latencyP95Ms, percentile(latencies, 0.95)),
  );
  if (row.topScoreDistribution !== undefined)
    distribution(row.topScoreDistribution, result);
  return result;
}

function distribution(value: unknown, result: Metrics) {
  const row = shape(value, ['definition', 'limitations', 'groups']);
  valid(text(row.definition, 1024) && text(row.limitations, 1024));
  const groups = shape(row.groups, [
    'positive',
    'negative',
    'no-answer',
    'tenant-isolation',
  ]);
  Object.entries(groups).forEach(([name, value]) => {
    const group = shape(value, [
      'questionCount',
      'emptyResponseCount',
      'errorCount',
      'missingScoreCount',
      'nonDegraded',
      'degraded',
    ]);
    [
      'questionCount',
      'emptyResponseCount',
      'errorCount',
      'missingScoreCount',
    ].forEach((key) => valid(count(group[key], result.questionCount)));
    let samples = 0;
    ['nonDegraded', 'degraded'].forEach((key) => {
      const stats = shape(group[key], [
        'sampleCount',
        'min',
        'p05',
        'p25',
        'p50',
        'p75',
        'p95',
        'max',
        'mean',
      ]);
      valid(count(stats.sampleCount, Number(group.questionCount)));
      samples += stats.sampleCount;
      Object.entries(stats)
        .filter(([name]) => name !== 'sampleCount')
        .forEach(([, value]) =>
          valid(
            stats.sampleCount === 0
              ? value === null
              : finite(value, -Number.MAX_SAFE_INTEGER),
          ),
        );
      if (stats.sampleCount > 0) {
        const ordered = ['min', 'p05', 'p25', 'p50', 'p75', 'p95', 'max'].map(
          (name) => Number(stats[name]),
        );
        valid(
          ordered.every(
            (value, index) => index === 0 || value >= ordered[index - 1],
          ) &&
            Number(stats.mean) >= ordered[0] &&
            Number(stats.mean) <= ordered[6],
        );
      }
    });
    valid(
      samples +
        Number(group.emptyResponseCount) +
        Number(group.errorCount) +
        Number(group.missingScoreCount) ===
        group.questionCount,
    );
    if (name === 'positive')
      valid(group.questionCount === result.positiveCount);
    if (name === 'negative')
      valid(group.questionCount === result.negativeCount);
  });
}

function validatePredictions(
  value: unknown,
  result: Metrics,
  mode: 'dense' | 'hybrid',
) {
  valid(
    Array.isArray(value) &&
      value.length === result.questionCount - result.missingPredictionCount,
  );
  const seen = new Set<string>();
  let degraded = 0,
    mismatches = 0;
  const errors: Record<string, number> = {};
  for (const item of value) {
    const row = shape(
      item,
      ['id', 'sources', 'latencyMs'],
      ['mode', 'degraded', 'error'],
    );
    valid(text(row.id) && !seen.has(row.id) && finite(row.latencyMs));
    seen.add(row.id);
    const detail = result.details.find((detail) => detail.id === row.id);
    valid(
      detail &&
        detail.latencyMs === row.latencyMs &&
        detail.failed === (row.error !== undefined),
    );
    valid(
      Array.isArray(row.sources) &&
        row.sources.length === detail.retrievedSourceIds.length,
    );
    row.sources.forEach((source, index) => {
      const hit = shape(
        source,
        ['sourceId', 'score'],
        ['tenantId', 'knowledgeBase'],
      );
      valid(
        text(hit.sourceId) &&
          hit.sourceId === detail.retrievedSourceIds[index] &&
          finite(hit.score, -Number.MAX_SAFE_INTEGER),
      );
      ['tenantId', 'knowledgeBase'].forEach((key) =>
        valid(hit[key] === undefined || hit[key] === null || text(hit[key])),
      );
    });
    if (row.error !== undefined) {
      valid(
        errorCode(row.error) &&
          row.mode === undefined &&
          row.degraded === undefined,
      );
      errors[row.error] = (errors[row.error] || 0) + 1;
    } else {
      valid(
        ['dense', 'hybrid'].includes(row.mode as string) &&
          typeof row.degraded === 'boolean',
      );
      degraded += Number(row.degraded);
      mismatches += Number(row.mode !== mode);
    }
  }
  valid(
    degraded === result.degradedCount &&
      mismatches === result.modeMismatchCount &&
      Object.keys(errors).length === Object.keys(result.errorCodes).length &&
      Object.entries(errors).every(
        ([key, count]) => result.errorCodes[key] === count,
      ),
  );
  result.details
    .filter((row) => !seen.has(row.id))
    .forEach((row) => valid(row.failed && row.latencyMs === null));
}

export function parseLiveEvaluationReport(
  content: string,
): LiveEvaluationReport {
  valid(content.length <= MAX_EVALUATION_REPORT_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('文件不是有效 JSON，请选择评估工具输出的报告。');
  }
  const row = shape(
    parsed,
    [
      'schemaVersion',
      'status',
      'startedAt',
      'finishedAt',
      'temporaryCollection',
      'scope',
      'provenance',
      'setup',
      'configuration',
      'limitations',
      'cleanup',
      'predictions',
      'results',
      'hybridMinusDense',
      'acceptance',
    ],
    ['errorCode'],
  );
  valid(
    row.schemaVersion === 1 &&
      ['completed', 'failed'].includes(row.status as string) &&
      row.scope === 'synthetic-regression-only',
  );
  valid(
    text(row.startedAt) &&
      text(row.finishedAt) &&
      Number.isFinite(Date.parse(row.startedAt)) &&
      Number.isFinite(Date.parse(row.finishedAt)) &&
      Date.parse(row.finishedAt) >= Date.parse(row.startedAt),
  );
  valid(
    typeof row.temporaryCollection === 'string' &&
      /^rag_eval_[a-f0-9]{32}$/.test(row.temporaryCollection),
  );
  valid(row.errorCode === undefined || errorCode(row.errorCode));
  valid(
    Array.isArray(row.limitations) &&
      row.limitations.length <= 20 &&
      row.limitations.every((item) => text(item, 1024)),
  );
  const provenance = shape(
    row.provenance,
    [
      'datasetSha256',
      'corpusSha256',
      'engineSourceSha256',
      'engineLockSha256',
      'gitHead',
    ],
    ['dependencies'],
  );
  [
    'datasetSha256',
    'corpusSha256',
    'engineSourceSha256',
    'engineLockSha256',
  ].forEach((key) =>
    valid(
      typeof provenance[key] === 'string' &&
        /^[a-f0-9]{64}$/.test(provenance[key] as string),
    ),
  );
  valid(
    provenance.gitHead === null ||
      (typeof provenance.gitHead === 'string' &&
        /^[a-f0-9]{40,64}$/.test(provenance.gitHead)),
  );
  if (provenance.dependencies !== undefined)
    Object.values(
      shape(provenance.dependencies, ['llama-index-core', 'httpx', 'pydantic']),
    ).forEach((version) =>
      valid(
        typeof version === 'string' && /^[0-9A-Za-z.+-]{1,64}$/.test(version),
      ),
    );
  const setup = shape(
    row.setup,
    [
      'documentCount',
      'questionCount',
      'documentEmbeddingBatches',
      'documentEmbeddingsBuiltOnce',
      'queryEmbeddingRequestLimit',
      'rerankRequestLimit',
    ],
    [
      'documentEmbeddingRequestsCompleted',
      'readbackCounts',
      'sparseReadyForAllScopes',
    ],
  );
  Object.entries(setup)
    .filter(
      ([key]) =>
        ![
          'documentEmbeddingsBuiltOnce',
          'readbackCounts',
          'sparseReadyForAllScopes',
        ].includes(key),
    )
    .forEach(([, value]) => valid(count(value, 100000)));
  valid(
    setup.documentEmbeddingsBuiltOnce === true &&
      (setup.sparseReadyForAllScopes === undefined ||
        typeof setup.sparseReadyForAllScopes === 'boolean'),
  );
  if (setup.readbackCounts !== undefined)
    Object.entries(object(setup.readbackCounts)).forEach(([key, value]) =>
      valid(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key) && count(value)),
    );
  const config = shape(
    row.configuration,
    [
      'topK',
      'candidateCount',
      'similarityThreshold',
      'retrievalTimeoutSeconds',
      'rerankTimeoutSeconds',
      'pairOrder',
      'embeddingModel',
      'embeddingDimension',
      'rerankModel',
      'sparseModel',
    ],
    ['rerankScoreThreshold'],
  );
  valid(
    count(config.topK, 20) &&
      config.topK > 0 &&
      count(config.candidateCount, 100) &&
      config.candidateCount >= config.topK &&
      finite(config.similarityThreshold, 0, 1) &&
      finite(config.retrievalTimeoutSeconds) &&
      finite(config.rerankTimeoutSeconds) &&
      count(config.embeddingDimension, 100000) &&
      config.embeddingDimension > 0 &&
      config.pairOrder === 'alternating-dense-first-hybrid-first',
  );
  ['embeddingModel', 'rerankModel', 'sparseModel'].forEach((key) =>
    valid(
      typeof config[key] === 'string' &&
        /^[A-Za-z0-9._/-]{1,100}$/.test(config[key] as string),
    ),
  );
  valid(
    config.rerankScoreThreshold === undefined ||
      finite(config.rerankScoreThreshold, 0, 1),
  );
  const results = shape(row.results, ['dense', 'hybrid']);
  const dense = metrics(results.dense),
    hybrid = metrics(results.hybrid);
  valid(
    dense.k === config.topK &&
      hybrid.k === dense.k &&
      dense.questionCount === setup.questionCount &&
      hybrid.questionCount === dense.questionCount &&
      dense.positiveCount === hybrid.positiveCount &&
      dense.details.every(
        (item, index) =>
          item.id === hybrid.details[index].id &&
          (item.recall === undefined) ===
            (hybrid.details[index].recall === undefined),
      ),
  );
  const predictions = shape(row.predictions, ['dense', 'hybrid']);
  validatePredictions(predictions.dense, dense, 'dense');
  validatePredictions(predictions.hybrid, hybrid, 'hybrid');
  const delta = shape(row.hybridMinusDense, DELTAS);
  DELTAS.forEach((key) => {
    valid(delta[key] === null || finite(delta[key], -Number.MAX_SAFE_INTEGER));
    valid(
      close(
        delta[key] as number | null,
        dense[key] === null || hybrid[key] === null
          ? null
          : hybrid[key]! - dense[key]!,
      ),
    );
  });
  const cleanup = shape(
    row.cleanup,
    ['required', 'attempted', 'verifiedAbsent'],
    ['deleteStatus', 'readbackStatus', 'errorCode'],
  );
  ['required', 'attempted', 'verifiedAbsent'].forEach((key) =>
    valid(typeof cleanup[key] === 'boolean'),
  );
  ['deleteStatus', 'readbackStatus'].forEach((key) =>
    valid(
      cleanup[key] === undefined ||
        (count(cleanup[key], 599) && Number(cleanup[key]) >= 100),
    ),
  );
  valid(cleanup.errorCode === undefined || errorCode(cleanup.errorCode));
  valid(!cleanup.attempted || cleanup.required);
  valid(
    cleanup.verifiedAbsent ===
      (cleanup.required &&
        cleanup.attempted &&
        [200, 202, 204, 404].includes(Number(cleanup.deleteStatus)) &&
        cleanup.readbackStatus === 404),
  );
  const acceptance = shape(row.acceptance, ['passed', 'checks']);
  const checks = shape(acceptance.checks, Object.keys(LIVE_CHECK_LABELS));
  Object.values(checks).forEach((value) => valid(typeof value === 'boolean'));
  const both = [dense, hybrid];
  const expected = {
    completeResponses: both.every((item) => item.errorCount === 0),
    noScopeLeaks: both.every((item) => item.scopeLeakCount === 0),
    knownSources: both.every((item) => item.unknownSourceCount === 0),
    correctEmptyResponses: both.every(
      (item) => item.correctEmptyCount === item.negativeCount,
    ),
    allReranksCompleted: both.every((item) => item.degradedCount === 0),
    expectedRetrievalMode: both.every((item) => item.modeMismatchCount === 0),
    hybridRecallNoRegression:
      delta.recallAtK !== null && Number(delta.recallAtK) >= -1e-12,
    hybridMrrNoRegression:
      delta.mrrAtK !== null && Number(delta.mrrAtK) >= -1e-12,
    hybridNdcgNoRegression:
      delta.ndcgAtK !== null && Number(delta.ndcgAtK) >= -1e-12,
    temporaryCollectionRemoved: cleanup.verifiedAbsent,
    runCompleted: row.status === 'completed',
  };
  valid(
    Object.entries(expected).every(([key, value]) => checks[key] === value) &&
      acceptance.passed === Object.values(checks).every(Boolean),
  );
  // 只投影界面所需汇总；不把预测、正文、任意元数据或临时集合名称交给视图。
  const summary = (value: Metrics): Summary =>
    Object.fromEntries(
      ['schemaVersion', 'k', ...COUNTS, ...DELTAS, 'errorCodes'].map((key) => [
        key,
        value[key as keyof Metrics],
      ]),
    ) as Summary;
  return {
    kind: 'live-comparison',
    status: row.status as LiveEvaluationReport['status'],
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    results: { dense: summary(dense), hybrid: summary(hybrid) },
    hybridMinusDense: delta as LiveEvaluationReport['hybridMinusDense'],
    acceptance: acceptance as LiveEvaluationReport['acceptance'],
    cleanup: cleanup as LiveEvaluationReport['cleanup'],
    errorCode: row.errorCode as string | undefined,
  };
}
