import { Alert, Descriptions, Space, Table, Tag } from 'antd';
import type { LiveEvaluationReport } from './liveEvaluationReport';
import { LIVE_CHECK_LABELS } from './liveEvaluationReport';

export default function LiveEvaluationReportView({
  report,
  fileName,
}: {
  report: LiveEvaluationReport;
  fileName: string;
}) {
  const { dense, hybrid } = report.results;
  const metrics = [
    { key: 'questionCount', label: '问题数' },
    { key: 'positiveCount', label: '正例数' },
    { key: 'negativeCount', label: '负例数' },
    { key: 'recallAtK', label: `Recall@${dense.k}`, decimals: 4 },
    { key: 'mrrAtK', label: `MRR@${dense.k}`, decimals: 4 },
    { key: 'ndcgAtK', label: `nDCG@${dense.k}`, decimals: 4 },
    { key: 'falseNegativeCount', label: '漏召回' },
    { key: 'falsePositiveCount', label: '误召回' },
    { key: 'correctEmptyCount', label: '正确空结果' },
    { key: 'latencyP50Ms', label: '延迟 P50', decimals: 1, unit: ' ms' },
    { key: 'latencyP95Ms', label: '延迟 P95', decimals: 1, unit: ' ms' },
    { key: 'latencySampleCount', label: '延迟采样数' },
    { key: 'errorCount', label: '错误数' },
    { key: 'missingPredictionCount', label: '缺失响应' },
    { key: 'timeoutCount', label: '超时' },
    { key: 'scopeLeakCount', label: '越界命中（泄漏）' },
    { key: 'blockedScopeViolationCount', label: '已拦截的越界请求' },
    { key: 'unknownSourceCount', label: '未知来源命中' },
    { key: 'degradedCount', label: '重排降级' },
    { key: 'modeMismatchCount', label: '检索模式不符' },
  ].map((item) => {
    const key = item.key as Exclude<keyof typeof dense, 'errorCodes'>;
    const format = (value: number | null, signed = false) =>
      value === null
        ? '—'
        : `${signed && value > 0 ? '+' : ''}${value.toFixed(
            item.decimals || 0,
          )}${item.unit || ''}`;
    const delta =
      report.hybridMinusDense[item.key as keyof typeof report.hybridMinusDense];
    return {
      key: item.key,
      label: item.label,
      dense: format(dense[key]),
      hybrid: format(hybrid[key]),
      delta: delta === undefined ? '—' : format(delta, true),
    };
  });
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="报告文件" span={2}>
          {fileName}
        </Descriptions.Item>
        <Descriptions.Item label="评估方式">
          真实模型 dense / hybrid 配对比较
        </Descriptions.Item>
        <Descriptions.Item label="执行状态">
          <Tag color={report.status === 'completed' ? 'success' : 'error'}>
            {report.status === 'completed' ? '执行完成' : '执行失败'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {report.startedAt}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {report.finishedAt}
        </Descriptions.Item>
        <Descriptions.Item label="报告总验收结果" span={2}>
          <Tag color={report.acceptance.passed ? 'success' : 'error'}>
            {report.acceptance.passed ? '通过' : '未通过'}
          </Tag>
        </Descriptions.Item>
        {report.errorCode && (
          <Descriptions.Item label="执行错误码" span={2}>
            {report.errorCode}
          </Descriptions.Item>
        )}
      </Descriptions>
      <Table
        dataSource={metrics}
        rowKey="key"
        size="small"
        pagination={false}
        columns={[
          { title: '指标', dataIndex: 'label' },
          { title: 'Dense', dataIndex: 'dense' },
          { title: 'Hybrid', dataIndex: 'hybrid' },
          { title: 'Hybrid − Dense', dataIndex: 'delta' },
        ]}
      />
      <Space wrap>
        {Object.entries(report.acceptance.checks).map(([key, passed]) => (
          <Tag key={key} color={passed ? 'success' : 'error'}>
            {LIVE_CHECK_LABELS[key as keyof typeof LIVE_CHECK_LABELS]}：
            {passed ? '通过' : '未通过'}
          </Tag>
        ))}
      </Space>
      <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="临时集合清理">
          <Tag color={report.cleanup.verifiedAbsent ? 'success' : 'warning'}>
            {report.cleanup.verifiedAbsent
              ? '已读回确认不存在'
              : report.cleanup.required
              ? '未确认完成'
              : '无需清理'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="已尝试清理">
          {report.cleanup.attempted ? '是' : '否'}
        </Descriptions.Item>
        <Descriptions.Item label="删除 / 读回 HTTP 状态">
          {report.cleanup.deleteStatus ?? '—'} /{' '}
          {report.cleanup.readbackStatus ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="清理错误码">
          {report.cleanup.errorCode || '无'}
        </Descriptions.Item>
        {(['dense', 'hybrid'] as const).map((mode) => (
          <Descriptions.Item
            key={mode}
            label={`${mode === 'dense' ? 'Dense' : 'Hybrid'} 错误分类`}
            span={2}
          >
            {Object.entries(report.results[mode].errorCodes)
              .map(([code, count]) => `${code}: ${count}`)
              .join('；') || '无'}
          </Descriptions.Item>
        ))}
      </Descriptions>
      <Alert
        showIcon
        type="warning"
        message="合成样本的来源级比较，不代表真实业务或当前服务验收。"
        description="报告直接调用 Python 检索实现；耗时不含 Java HTTP/RPC 与网络开销。未评估 OCR、生成答案正确性或忠实度；单轮比较不代表统计显著改善或压力测试。总验收按报告已有检查项显示，未新增指标阈值。"
      />
    </Space>
  );
}
