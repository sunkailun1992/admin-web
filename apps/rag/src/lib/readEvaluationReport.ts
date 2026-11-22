import {
  EvaluationReportError,
  MAX_EVALUATION_REPORT_BYTES,
  parseEvaluationReport,
} from './evaluationReport.ts';
import { parseLiveEvaluationReport } from './liveEvaluationReport.ts';

/** 读评估工具的报告（照 1.2.4）：带 results 的是 live_compare 比较报告，其余按评估器报告读。 */
export function readEvaluationReport(content: string) {
  if (content.length > MAX_EVALUATION_REPORT_BYTES)
    throw new EvaluationReportError('tooLarge');
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new EvaluationReportError('invalidJson');
  }
  return value && typeof value === 'object' && Object.hasOwn(value, 'results')
    ? parseLiveEvaluationReport(content)
    : parseEvaluationReport(content);
}
