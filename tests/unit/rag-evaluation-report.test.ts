import {
  MAX_EVALUATION_REPORT_BYTES,
  parseEvaluationReport,
} from '@/pages/Rag/Document/evaluationReport';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// 固定夹具由 rag/evaluation/runner.py 对虚构评估集中的一正一负样本生成，没有调用模型。
const fixture = readFileSync(
  new URL('../fixtures/rag-evaluation-v1.json', import.meta.url),
  'utf8',
);
const sample = () => JSON.parse(fixture);
const parse = (value: unknown) => parseEvaluationReport(JSON.stringify(value));

test('reads the real Python evaluator report without a network request', () => {
  const report = parseEvaluationReport(fixture);
  expect(report.schemaVersion).toBe(1);
  expect(report.questionCount).toBe(2);
  expect(report.recallAtK).toBe(1);
  expect(report.details[1].correctEmpty).toBe(true);
  expect(report.latencyP95Ms).toBe(195);
  expect(report.provenance.mode).toBe('offline');
  expect(report.gate.passed).toBe(true);
});

test('rejects raw prediction, unknown fields and unsupported versions', () => {
  for (const value of [
    [{ id: 'q1', response: { content: 'not a report' } }],
    { ...sample(), schemaVersion: 2 },
    { ...sample(), token: 'must-not-be-read' },
  ])
    expect(() => parse(value)).toThrow();
  const report = sample();
  report.details[0].query = 'raw query is not part of a report';
  expect(() => parse(report)).toThrow();
});

test('rejects control characters in report text, C1 controls included', () => {
  for (const id of ['q\u0000', 'q\u0007', 'q\u007f', 'q\u0085', 'q\u009f']) {
    const report = sample();
    report.details[0].id = id;
    expect(() => parse(report), JSON.stringify(id)).toThrow();
  }
});

test('rejects malformed or oversized JSON without echoing its contents', () => {
  expect(() => parseEvaluationReport('{"sensitive":"not closed')).toThrow(
    /不是有效 JSON/,
  );
  expect(() =>
    parseEvaluationReport(' '.repeat(MAX_EVALUATION_REPORT_BYTES + 1)),
  ).toThrow();
});

test('rejects duplicate question IDs, missing rows and invalid metric values', () => {
  const duplicate = sample();
  duplicate.details[1].id = duplicate.details[0].id;
  const missing = sample();
  missing.details.pop();
  const badScore = sample();
  badScore.recallAtK = 1.1;
  const badLatency = sample();
  badLatency.details[0].latencyMs = -1;
  const badSources = sample();
  badSources.details[0].retrievedSourceIds = [{ content: 'raw payload' }];
  for (const value of [duplicate, missing, badScore, badLatency, badSources])
    expect(() => parse(value)).toThrow();
});

test('rejects gate results that hide errors or contradict their checks', () => {
  const report = sample();
  report.details[0].failed = true;
  report.errorCount = 1;
  expect(() => parse(report)).toThrow();
  report.gate.checks.completeResponses = false;
  expect(() => parse(report)).toThrow();
  report.gate.passed = false;
  expect(parse(report).gate.passed).toBe(false);
});

test('accepts explicit failed thresholds and empty latency samples', () => {
  const report = sample();
  report.gate.checks.minimumRecall = false;
  report.gate.passed = false;
  report.details.forEach((row: { latencyMs: number | null }) => {
    row.latencyMs = null;
  });
  report.latencySampleCount = 0;
  report.latencyP50Ms = null;
  report.latencyP95Ms = null;
  expect(parse(report).latencyP95Ms).toBe(null);
  report.latencyP50Ms = 0;
  expect(() => parse(report)).toThrow();
});
