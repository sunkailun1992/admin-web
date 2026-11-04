export const MAX_EVALUATION_REPORT_BYTES = 2 * 1024 * 1024;

export const EVALUATION_CHECK_LABELS = {
  completeResponses: '响应完整',
  noScopeLeaks: '没有跨租户或知识库命中',
  knownSources: '来源均在语料中',
  correctEmptyResponses: '负例均正确返回空结果',
  minimumRecall: '达到召回率阈值',
  minimumMrr: '达到 MRR 阈值',
  latencyBudget: '达到延迟阈值',
};

export type EvaluationDetail = {
  id: string;
  failed: boolean;
  scopeLeak: boolean;
  retrievedSourceIds: string[];
  latencyMs: number | null;
  recall?: number;
  reciprocalRank?: number;
  ndcg?: number;
  correctEmpty?: boolean;
};

export type EvaluationReport = {
  schemaVersion: 1;
  k: number;
  questionCount: number;
  positiveCount: number;
  negativeCount: number;
  recallAtK: number | null;
  mrrAtK: number | null;
  ndcgAtK: number | null;
  falseNegativeCount: number;
  falsePositiveCount: number;
  correctEmptyCount: number;
  errorCount: number;
  missingPredictionCount: number;
  scopeLeakCount: number;
  unknownSourceCount: number;
  latencySampleCount: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  details: EvaluationDetail[];
  provenance: {
    evaluatedAt: string;
    datasetSha256: string;
    corpusSha256: string;
    mode: 'offline' | 'http-java' | 'http-engine';
    tenantFilter: string | null;
  };
  gate: {
    passed: boolean;
    checks: Partial<Record<keyof typeof EVALUATION_CHECK_LABELS, boolean>>;
  };
};

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
  'latencySampleCount',
] as const;
const SCORES = ['recallAtK', 'mrrAtK', 'ndcgAtK'] as const;
const REQUIRED_CHECKS = [
  'completeResponses',
  'noScopeLeaks',
  'knownSources',
  'correctEmptyResponses',
];

function requireValid(condition: unknown): asserts condition {
  if (!condition)
    throw new Error(
      '报告格式或统计不一致，请选择评估工具生成的 schemaVersion=1 报告 JSON，而不是原始预测文件。',
    );
}

function record(value: unknown): Record<string, unknown> {
  requireValid(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function keys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  requireValid(
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
      Object.keys(value).every(
        (key) => required.includes(key) || optional.includes(key),
      ),
  );
}

function number(value: unknown, max = Number.MAX_SAFE_INTEGER) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max
  );
}

function text(value: unknown) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function parseEvaluationReport(content: string): EvaluationReport {
  requireValid(content.length <= MAX_EVALUATION_REPORT_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('文件不是有效 JSON，请选择评估工具输出的报告。');
  }
  const value = record(parsed);
  keys(value, [
    'schemaVersion',
    'k',
    ...COUNTS,
    ...SCORES,
    'unknownSourceCount',
    'latencyP50Ms',
    'latencyP95Ms',
    'details',
    'provenance',
    'gate',
  ]);
  requireValid(
    value.schemaVersion === 1 &&
      Number.isSafeInteger(value.k) &&
      number(value.k, 1000) &&
      Number(value.k) > 0,
  );
  COUNTS.forEach((key) =>
    requireValid(Number.isSafeInteger(value[key]) && number(value[key], 10000)),
  );
  requireValid(
    Number.isSafeInteger(value.unknownSourceCount) &&
      number(value.unknownSourceCount),
  );
  SCORES.forEach((key) =>
    requireValid(value[key] === null || number(value[key], 1)),
  );
  ['latencyP50Ms', 'latencyP95Ms'].forEach((key) =>
    requireValid(value[key] === null || number(value[key])),
  );
  requireValid(
    Array.isArray(value.details) &&
      value.details.length === value.questionCount,
  );
  const seen = new Set<string>();
  value.details.forEach((detail) => {
    const row = record(detail);
    const positive = Object.prototype.hasOwnProperty.call(row, 'recall');
    keys(row, [
      'id',
      'failed',
      'scopeLeak',
      'retrievedSourceIds',
      'latencyMs',
      ...(positive ? ['recall', 'reciprocalRank', 'ndcg'] : ['correctEmpty']),
    ]);
    requireValid(text(row.id) && !seen.has(row.id as string));
    seen.add(row.id as string);
    requireValid(
      typeof row.failed === 'boolean' && typeof row.scopeLeak === 'boolean',
    );
    requireValid(row.latencyMs === null || number(row.latencyMs));
    requireValid(
      Array.isArray(row.retrievedSourceIds) &&
        row.retrievedSourceIds.length <= 10000 &&
        row.retrievedSourceIds.every(text),
    );
    if (positive)
      ['recall', 'reciprocalRank', 'ndcg'].forEach((key) =>
        requireValid(number(row[key], 1)),
      );
    else requireValid(typeof row.correctEmpty === 'boolean');
  });
  const provenance = record(value.provenance);
  keys(provenance, [
    'evaluatedAt',
    'datasetSha256',
    'corpusSha256',
    'mode',
    'tenantFilter',
  ]);
  requireValid(
    text(provenance.evaluatedAt) &&
      Number.isFinite(Date.parse(provenance.evaluatedAt as string)),
  );
  ['datasetSha256', 'corpusSha256'].forEach((key) =>
    requireValid(
      typeof provenance[key] === 'string' &&
        /^[a-f0-9]{64}$/.test(provenance[key] as string),
    ),
  );
  requireValid(
    ['offline', 'http-java', 'http-engine'].includes(provenance.mode as string),
  );
  requireValid(
    provenance.tenantFilter === null || text(provenance.tenantFilter),
  );
  const gate = record(value.gate);
  keys(gate, ['passed', 'checks']);
  const checks = record(gate.checks);
  keys(checks, REQUIRED_CHECKS, [
    'minimumRecall',
    'minimumMrr',
    'latencyBudget',
  ]);
  requireValid(
    typeof gate.passed === 'boolean' &&
      Object.values(checks).every((check) => typeof check === 'boolean') &&
      gate.passed === Object.values(checks).every(Boolean),
  );

  const report = value as unknown as EvaluationReport;
  requireValid(
    report.positiveCount + report.negativeCount === report.questionCount &&
      report.details.filter((row) => row.recall !== undefined).length ===
        report.positiveCount &&
      report.details.filter((row) => row.failed).length === report.errorCount &&
      report.details.filter((row) => row.scopeLeak).length ===
        report.scopeLeakCount &&
      report.details.filter((row) => row.correctEmpty).length ===
        report.correctEmptyCount &&
      report.details.filter((row) => row.latencyMs !== null).length ===
        report.latencySampleCount &&
      report.missingPredictionCount <= report.errorCount &&
      report.falseNegativeCount <= report.positiveCount &&
      report.falsePositiveCount <= report.negativeCount,
  );
  requireValid(
    checks.completeResponses === (report.errorCount === 0) &&
      checks.noScopeLeaks === (report.scopeLeakCount === 0) &&
      checks.knownSources === (report.unknownSourceCount === 0) &&
      checks.correctEmptyResponses ===
        (report.correctEmptyCount === report.negativeCount),
  );
  requireValid(
    SCORES.every(
      (key) => (report[key] === null) === (report.positiveCount === 0),
    ) &&
      (report.latencyP50Ms === null) === (report.latencySampleCount === 0) &&
      (report.latencyP95Ms === null) === (report.latencySampleCount === 0),
  );
  return report;
}
