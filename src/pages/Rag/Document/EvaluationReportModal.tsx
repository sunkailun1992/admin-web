import {
  Alert,
  Button,
  Descriptions,
  Modal,
  Space,
  Table,
  Tag,
  Upload,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { EvaluationDetail, EvaluationReport } from './evaluationReport';
import {
  EVALUATION_CHECK_LABELS,
  MAX_EVALUATION_REPORT_BYTES,
} from './evaluationReport';
import styles from './index.less';
import type { LiveEvaluationReport } from './liveEvaluationReport';
import LiveEvaluationReportView from './LiveEvaluationReportView';
import { readEvaluationReport } from './readEvaluationReport';

const score = (value?: number | null) =>
  value == null ? '—' : value.toFixed(4);
const latency = (value: number | null) =>
  value === null ? '—' : `${value.toFixed(1)} ms`;

export default function EvaluationReportModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [report, setReport] = useState<
    EvaluationReport | LiveEvaluationReport
  >();
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  return (
    <Modal
      open
      title="检索评估报告"
      footer={null}
      onCancel={onClose}
      width={1100}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          showIcon
          type="info"
          message="仅在当前浏览器读取报告，不上传或保存文件"
          description="请选择评估工具生成的报告 JSON（不超过 2 MB），不要选择原始预测或业务数据。这里展示的是报告记录，不代表当前服务状态；离线结果也不代表真实模型或 OCR 质量。"
        />
        <Upload
          accept=".json,application/json"
          showUploadList={false}
          beforeUpload={async (file) => {
            const current = ++generation.current;
            setReading(true);
            setError('');
            setReport(undefined);
            setFileName('');
            try {
              if (
                !file.name.toLowerCase().endsWith('.json') ||
                file.size === 0 ||
                file.size > MAX_EVALUATION_REPORT_BYTES
              ) {
                throw new Error(
                  '请选择非空 JSON 报告，文件大小不能超过 2 MB。',
                );
              }
              const parsed = readEvaluationReport(await file.text());
              if (current !== generation.current) return Upload.LIST_IGNORE;
              setReport(parsed);
              setFileName(file.name);
            } catch (cause) {
              if (current === generation.current)
                setError(
                  cause instanceof Error
                    ? cause.message
                    : '报告读取失败，请重新选择文件。',
                );
            } finally {
              if (current === generation.current) setReading(false);
            }
            return Upload.LIST_IGNORE;
          }}
        >
          <Button loading={reading}>选择本地评估报告</Button>
        </Upload>
        {error && <Alert showIcon type="error" message={error} />}
        {report &&
          ('kind' in report ? (
            <LiveEvaluationReportView report={report} fileName={fileName} />
          ) : (
            <>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2, md: 3 }}
                size="small"
              >
                <Descriptions.Item label="报告文件" span={3}>
                  {fileName}
                </Descriptions.Item>
                <Descriptions.Item label="评估方式">
                  {report.provenance.mode === 'offline'
                    ? '离线预测'
                    : report.provenance.mode === 'http-java'
                    ? 'Java 接口采集'
                    : 'Engine 接口采集'}
                </Descriptions.Item>
                <Descriptions.Item label="生成时间">
                  {report.provenance.evaluatedAt}
                </Descriptions.Item>
                <Descriptions.Item label="报告门禁结果">
                  <Tag color={report.gate.passed ? 'success' : 'error'}>
                    {report.gate.passed ? '通过' : '未通过'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="问题 / 正例 / 负例">
                  {report.questionCount} / {report.positiveCount} /{' '}
                  {report.negativeCount}
                </Descriptions.Item>
                <Descriptions.Item label={`Recall@${report.k}`}>
                  {score(report.recallAtK)}
                </Descriptions.Item>
                <Descriptions.Item label={`MRR@${report.k}`}>
                  {score(report.mrrAtK)}
                </Descriptions.Item>
                <Descriptions.Item label={`nDCG@${report.k}`}>
                  {score(report.ndcgAtK)}
                </Descriptions.Item>
                <Descriptions.Item label="延迟 P50 / P95">
                  {latency(report.latencyP50Ms)} /{' '}
                  {latency(report.latencyP95Ms)}
                </Descriptions.Item>
                <Descriptions.Item label="延迟采样数">
                  {report.latencySampleCount}
                </Descriptions.Item>
                <Descriptions.Item label="错误 / 缺失响应">
                  {report.errorCount} / {report.missingPredictionCount}
                </Descriptions.Item>
                <Descriptions.Item label="漏召回 / 误召回">
                  {report.falseNegativeCount} / {report.falsePositiveCount}
                </Descriptions.Item>
                <Descriptions.Item label="正确空结果">
                  {report.correctEmptyCount}
                </Descriptions.Item>
                <Descriptions.Item label="越界命中 / 未知来源">
                  {report.scopeLeakCount} / {report.unknownSourceCount}
                </Descriptions.Item>
                <Descriptions.Item label="数据集 SHA-256" span={3}>
                  <span className={styles.reportFingerprint}>
                    {report.provenance.datasetSha256}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="语料 SHA-256" span={3}>
                  <span className={styles.reportFingerprint}>
                    {report.provenance.corpusSha256}
                  </span>
                </Descriptions.Item>
              </Descriptions>
              <Space wrap>
                {Object.entries(report.gate.checks).map(([key, passed]) => (
                  <Tag key={key} color={passed ? 'success' : 'error'}>
                    {
                      EVALUATION_CHECK_LABELS[
                        key as keyof typeof EVALUATION_CHECK_LABELS
                      ]
                    }
                    ：{passed ? '通过' : '未通过'}
                  </Tag>
                ))}
              </Space>
              <Alert
                showIcon
                type="warning"
                message="分数按来源文档统计，不能替代切片准确性或真实业务验收。"
                description="真实模型、OCR、复杂表格和实际文档的召回质量需另行验证。未出现在门禁列表的指标未设置阈值，报告通过不表示这些指标达标。"
              />
              <Table<EvaluationDetail>
                dataSource={report.details}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: false }}
                scroll={{ x: 1000 }}
                columns={[
                  { title: '问题编号', dataIndex: 'id' },
                  {
                    title: '状态',
                    render: (_, row) => (
                      <Space wrap>
                        {row.failed && <Tag color="error">响应失败</Tag>}
                        {row.scopeLeak && <Tag color="error">越界</Tag>}
                        {!row.failed && !row.scopeLeak && <Tag>已评估</Tag>}
                      </Space>
                    ),
                  },
                  { title: 'Recall', dataIndex: 'recall', render: score },
                  { title: 'MRR', dataIndex: 'reciprocalRank', render: score },
                  { title: 'nDCG', dataIndex: 'ndcg', render: score },
                  {
                    title: '正确空结果',
                    dataIndex: 'correctEmpty',
                    render: (value?: boolean) =>
                      value === undefined ? '—' : value ? '是' : '否',
                  },
                  { title: '延迟', dataIndex: 'latencyMs', render: latency },
                  {
                    title: '命中来源编号',
                    dataIndex: 'retrievedSourceIds',
                    render: (ids: string[]) => (
                      <span className={styles.reportFingerprint}>
                        {ids.join('、') || '无'}
                      </span>
                    ),
                  },
                ]}
              />
            </>
          ))}
      </Space>
    </Modal>
  );
}
