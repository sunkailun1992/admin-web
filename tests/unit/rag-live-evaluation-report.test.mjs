import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const exports = {};
  const source = readFileSync(
    new URL(`../../src/pages/Rag/Document/${name}.ts`, import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInContext(
    compiled,
    createContext({ exports, require: (path) => load(path.replace('./', '')) }),
  );
  modules.set(name, exports);
  return exports;
}
const { readEvaluationReport } = load('readEvaluationReport');
// comparison_report 对 q001/q053 和固定合成预测生成指标；未调用模型。
// 时间、模型名、集合名与哈希均为虚构元数据，不是在线验收证据。
const fixture = readFileSync(
  new URL('../fixtures/rag-live-evaluation-v1.json', import.meta.url),
  'utf8',
);
const sample = () => JSON.parse(fixture);
const parse = (value) => readEvaluationReport(JSON.stringify(value));

test('reads the live_compare wrapper and projects only safe summary fields', () => {
  const report = readEvaluationReport(fixture);
  assert.equal(report.kind, 'live-comparison');
  assert.equal(report.acceptance.passed, true);
  assert.equal(report.results.dense.recallAtK, 1);
  assert.equal(report.results.hybrid.latencyP95Ms, 195);
  assert.equal(report.hybridMinusDense.mrrAtK, 0);
  assert.equal(report.cleanup.verifiedAbsent, true);
  for (const field of [
    'predictions',
    'temporaryCollection',
    'configuration',
    'provenance',
    'limitations',
  ])
    assert.equal(field in report, false);
  assert.equal('details' in report.results.dense, false);
  assert.equal('topScoreDistribution' in report.results.dense, false);
});

test('continues to read the original evaluator format through the same entry point', () => {
  const report = readEvaluationReport(
    readFileSync(
      new URL('../fixtures/rag-evaluation-v1.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(report.provenance.mode, 'offline');
  assert.equal(report.gate.passed, true);
  assert.equal('kind' in report, false);
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
  const report = parse(value);
  assert.equal(report.acceptance.passed, false);
  assert.equal(report.cleanup.verifiedAbsent, false);
  assert.equal(report.errorCode, 'INTERRUPTED');
  value.acceptance.passed = true;
  assert.throws(() => parse(value));
});

test('rejects hidden body, credential, and unknown fields at every report layer', () => {
  const additions = [
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
    assert.throws(
      () => parse(value),
      (error) => !/sentinel|private/.test(error.message),
    );
  }
});

test('rejects unsupported versions, partial reports, malformed JSON and oversized files', () => {
  const unsupported = sample();
  unsupported.schemaVersion = 2;
  const partial = sample();
  partial.status = 'running';
  delete partial.finishedAt;
  assert.throws(() => parse(unsupported));
  assert.throws(() => parse(partial));
  assert.throws(
    () => readEvaluationReport('{"private":"unclosed'),
    /不是有效 JSON/,
  );
  assert.throws(() => readEvaluationReport(' '.repeat(2 * 1024 * 1024 + 1)));
});

test('rejects non-finite numbers, inconsistent deltas, counts, and raw prediction mismatches', () => {
  const mutations = [
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
    assert.throws(() => parse(value));
  }
  assert.throws(() =>
    readEvaluationReport(
      fixture.replace('"recallAtK": 1.0', '"recallAtK": 1e400'),
    ),
  );
});

test('rejects an acceptance flag that contradicts metrics or cleanup readback', () => {
  for (const mutate of [
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
  ]) {
    const value = sample();
    mutate(value);
    assert.throws(() => parse(value));
  }
});

test('accepts older complete live reports before the optional score-threshold field', () => {
  const value = sample();
  delete value.configuration.rerankScoreThreshold;
  assert.equal(parse(value).acceptance.passed, true);
});
