import { readEvaluationReport } from '@/pages/Rag/Document/readEvaluationReport';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// comparison_report 对 q001/q053 和固定合成预测生成指标；未调用模型。
// 时间、模型名、集合名与哈希均为虚构元数据，不是在线验收证据。
const fixture = readFileSync(
  new URL('../fixtures/rag-live-evaluation-v1.json', import.meta.url),
  'utf8',
);
const sample = () => JSON.parse(fixture);
type Report = ReturnType<typeof sample>;
const parse = (value: unknown) => readEvaluationReport(JSON.stringify(value));
// 报告按两种格式之一读出；用例按各自格式的字段读。
const live = (value: unknown) => value as Report;

test('reads the live_compare wrapper and projects only safe summary fields', () => {
  const report = live(readEvaluationReport(fixture));
  expect(report.kind).toBe('live-comparison');
  expect(report.acceptance.passed).toBe(true);
  expect(report.results.dense.recallAtK).toBe(1);
  expect(report.results.hybrid.latencyP95Ms).toBe(195);
  expect(report.hybridMinusDense.mrrAtK).toBe(0);
  expect(report.cleanup.verifiedAbsent).toBe(true);
  for (const field of [
    'predictions',
    'temporaryCollection',
    'configuration',
    'provenance',
    'limitations',
  ])
    expect(field in report).toBe(false);
  expect('details' in report.results.dense).toBe(false);
  expect('topScoreDistribution' in report.results.dense).toBe(false);
});

test('continues to read the original evaluator format through the same entry point', () => {
  const report = live(
    readEvaluationReport(
      readFileSync(
        new URL('../fixtures/rag-evaluation-v1.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  expect(report.provenance.mode).toBe('offline');
  expect(report.gate.passed).toBe(true);
  expect('kind' in report).toBe(false);
});

test('preserves failed acceptance and failed cleanup without inventing a passing gate', () => {
  const value = sample();
  value.status = 'failed';
  value.errorCode = 'INTERRUPTED';
  value.cleanup = {
    required: true,
    attempted: true,
    verifiedAbsent: false,
    errorCode: 'EVALUATION_OPERATION_FAILED',
  };
  value.acceptance.checks.runCompleted = false;
  value.acceptance.checks.temporaryCollectionRemoved = false;
  value.acceptance.passed = false;
  const report = live(parse(value));
  expect(report.acceptance.passed).toBe(false);
  expect(report.cleanup.verifiedAbsent).toBe(false);
  expect(report.errorCode).toBe('INTERRUPTED');
  value.acceptance.passed = true;
  expect(() => parse(value)).toThrow();
});

test('rejects hidden body, credential, and unknown fields at every report layer', () => {
  const additions: Array<(value: Report) => void> = [
    (value) => {
      value.apiKey = 'sensitive sentinel';
    },
    (value) => {
      value.configuration.endpoint = 'https://example.invalid/private';
    },
    (value) => {
      value.provenance.token = 'sensitive sentinel';
    },
    (value) => {
      value.results.dense.details[0].query = 'private query';
    },
    (value) => {
      value.predictions.dense[0].sources[0].content = 'private document';
    },
    (value) => {
      value.cleanup.rawError = 'private upstream response';
    },
  ];
  for (const mutate of additions) {
    const value = sample();
    mutate(value);
    let error: unknown;
    try {
      parse(value);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toMatch(/sentinel|private/);
  }
});

test('rejects unsupported versions, partial reports, malformed JSON and oversized files', () => {
  const unsupported = sample();
  unsupported.schemaVersion = 2;
  const partial = sample();
  partial.status = 'running';
  delete partial.finishedAt;
  expect(() => parse(unsupported)).toThrow();
  expect(() => parse(partial)).toThrow();
  expect(() => readEvaluationReport('{"private":"unclosed')).toThrow(
    /不是有效 JSON/,
  );
  expect(() => readEvaluationReport(' '.repeat(2 * 1024 * 1024 + 1))).toThrow();
});

test('rejects non-finite numbers, inconsistent deltas, counts, and raw prediction mismatches', () => {
  const mutations: Array<(value: Report) => void> = [
    (value) => {
      value.results.dense.questionCount += 1;
    },
    (value) => {
      value.results.hybrid.schemaVersion = 2;
    },
    (value) => {
      value.results.dense.recallAtK = 1.1;
    },
    (value) => {
      value.results.dense.recallAtK = null;
    },
    (value) => {
      value.results.dense.latencyP50Ms = -1;
    },
    (value) => {
      value.results.dense.latencyP95Ms = 190;
    },
    (value) => {
      value.hybridMinusDense.latencyP95Ms = 4;
    },
    (value) => {
      value.results.dense.errorCodes.RETRIEVAL_TIMEOUT = 1;
    },
    (value) => {
      value.results.dense.details[1].id = value.results.dense.details[0].id;
    },
    (value) => {
      value.predictions.dense[0].mode = 'hybrid';
    },
    (value) => {
      value.predictions.hybrid[0].sources[0].sourceId = 'unknown-source';
    },
    (value) => {
      value.results.hybrid.topScoreDistribution.groups.positive.nonDegraded.sampleCount = 2;
    },
    (value) => {
      value.results.hybrid.topScoreDistribution.groups.negative.nonDegraded.max = 1;
    },
  ];
  for (const mutate of mutations) {
    const value = sample();
    mutate(value);
    expect(() => parse(value)).toThrow();
  }
  expect(() =>
    readEvaluationReport(
      fixture.replace('"recallAtK": 1.0', '"recallAtK": 1e400'),
    ),
  ).toThrow();
});

test('rejects an acceptance flag that contradicts metrics or cleanup readback', () => {
  const mutations: Array<(value: Report) => void> = [
    (value) => {
      value.acceptance.checks.correctEmptyResponses = false;
      value.acceptance.passed = false;
    },
    (value) => {
      value.cleanup.readbackStatus = 200;
    },
    (value) => {
      value.cleanup.attempted = false;
    },
    (value) => {
      delete value.acceptance.checks.temporaryCollectionRemoved;
    },
  ];
  for (const mutate of mutations) {
    const value = sample();
    mutate(value);
    expect(() => parse(value)).toThrow();
  }
});

test('accepts older complete live reports before the optional score-threshold field', () => {
  const value = sample();
  delete value.configuration.rerankScoreThreshold;
  expect(live(parse(value)).acceptance.passed).toBe(true);
});
