import {
  MAX_EVALUATION_REPORT_BYTES,
  parseEvaluationReport,
} from './evaluationReport';
import { parseLiveEvaluationReport } from './liveEvaluationReport';

export function readEvaluationReport(content: string) {
  if (content.length > MAX_EVALUATION_REPORT_BYTES)
    throw new Error('报告大小不能超过 2 MB。');
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('文件不是有效 JSON，请选择评估工具输出的报告。');
  }
  return value &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, 'results')
    ? parseLiveEvaluationReport(content)
    : parseEvaluationReport(content);
}
