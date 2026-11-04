import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
const compiled = ts.transpileModule(
  readFileSync(
    new URL(
      '../../src/pages/Rag/Document/evaluationReport.ts',
      import.meta.url,
    ),
    'utf8',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
runInContext(compiled, createContext({ exports: module.exports }));
const { parseEvaluationReport, MAX_EVALUATION_REPORT_BYTES } = module.exports;
// 固定夹具由 rag/evaluation/runner.py 对虚构评估集中的一正一负样本生成，没有调用模型。
const fixture = readFileSync(
  new URL('../fixtures/rag-evaluation-v1.json', import.meta.url),
  'utf8',
);
const sample = () => JSON.parse(fixture);
const parse = (value) => parseEvaluationReport(JSON.stringify(value));

test('reads the real Python evaluator report without a network request', () => {
  const report = parseEvaluationReport(fixture);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.questionCount, 2);
  assert.equal(report.recallAtK, 1);
  assert.equal(report.details[1].correctEmpty, true);
  assert.equal(report.latencyP95Ms, 195);
  assert.equal(report.provenance.mode, 'offline');
  assert.equal(report.gate.passed, true);
});

test('rejects raw prediction, unknown fields and unsupported versions', () => {
  for (const value of [
    [{ id: 'q1', response: { content: 'not a report' } }],
    { ...sample(), schemaVersion: 2 },
    { ...sample(), token: 'must-not-be-read' },
  ])
    assert.throws(() => parse(value));
  const report = sample();
  report.details[0].query = 'raw query is not part of a report';
  assert.throws(() => parse(report));
});

test('rejects malformed or oversized JSON without echoing its contents', () => {
  assert.throws(
    () => parseEvaluationReport('{"sensitive":"not closed'),
    /不是有效 JSON/,
  );
  assert.throws(() =>
    parseEvaluationReport(' '.repeat(MAX_EVALUATION_REPORT_BYTES + 1)),
  );
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
    assert.throws(() => parse(value));
});

test('rejects gate results that hide errors or contradict their checks', () => {
  const report = sample();
  report.details[0].failed = true;
  report.errorCount = 1;
  assert.throws(() => parse(report));
  report.gate.checks.completeResponses = false;
  assert.throws(() => parse(report));
  report.gate.passed = false;
  assert.equal(parse(report).gate.passed, false);
});

test('accepts explicit failed thresholds and empty latency samples', () => {
  const report = sample();
  report.gate.checks.minimumRecall = false;
  report.gate.passed = false;
  report.details.forEach((row) => {
    row.latencyMs = null;
  });
  report.latencySampleCount = 0;
  report.latencyP50Ms = null;
  report.latencyP95Ms = null;
  assert.equal(parse(report).latencyP95Ms, null);
  report.latencyP50Ms = 0;
  assert.throws(() => parse(report));
});
