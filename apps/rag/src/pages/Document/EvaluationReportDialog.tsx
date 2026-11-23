import {
  createDataTableColumns,
  DataTable,
  DescriptionList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  StatusBadge,
  UploadDropzone,
} from '@admin-web/ui';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../../components/Notice.tsx';
import {
  EvaluationReportError,
  MAX_EVALUATION_REPORT_BYTES,
  type EvaluationDetail,
  type EvaluationReport,
} from '../../lib/evaluationReport.ts';
import type {
  LiveCheck,
  LiveEvaluationReport,
} from '../../lib/liveEvaluationReport.ts';
import { readEvaluationReport } from '../../lib/readEvaluationReport.ts';

const PAGE_SIZE = 10;
const score = (value?: number | null) =>
  value == null ? '—' : value.toFixed(4);

function CheckBadges({
  checks,
  label,
}: {
  checks: Partial<Record<string, boolean>>;
  label: (key: string) => string;
}) {
  const { t } = useTranslation('rag');
  return (
    <ul className="rag:flex rag:flex-wrap rag:gap-2">
      {Object.entries(checks).map(([key, passed]) => (
        <li key={key}>
          <StatusBadge
            value={key}
            options={{
              [key]: {
                label: t('evaluation.check', {
                  label: label(key),
                  result: passed
                    ? t('evaluation.passed')
                    : t('evaluation.failed'),
                }),
                tone: passed ? 'success' : 'destructive',
              },
            }}
          />
        </li>
      ))}
    </ul>
  );
}

/** 延迟毫秒数；缺失为“—”。 */
const latencyText = (value: number | null, t: TFunction<'rag'>) =>
  value === null
    ? '—'
    : t('evaluation.milliseconds', { value: value.toFixed(1) });

const detailColumns = createDataTableColumns<EvaluationDetail>();

function OfflineReport({
  report,
  fileName,
}: {
  report: EvaluationReport;
  fileName: string;
}) {
  const { t } = useTranslation('rag');
  const [page, setPage] = useState(1);
  const latency = (value: number | null) => latencyText(value, t);
  const columns = useMemo(
    () =>
      detailColumns.columns([
        detailColumns.accessor('id', {
          header: t('evaluation.detailColumns.id'),
        }),
        detailColumns.display({
          id: 'state',
          header: t('evaluation.detailColumns.state'),
          cell: ({ row: { original: row } }) => (
            <span className="rag:flex rag:flex-wrap rag:gap-1">
              {row.failed ? (
                <StatusBadge
                  value="x"
                  options={{
                    x: {
                      label: t('evaluation.responseFailed'),
                      tone: 'destructive',
                    },
                  }}
                />
              ) : null}
              {row.scopeLeak ? (
                <StatusBadge
                  value="x"
                  options={{
                    x: {
                      label: t('evaluation.scopeLeak'),
                      tone: 'destructive',
                    },
                  }}
                />
              ) : null}
              {!row.failed && !row.scopeLeak ? (
                <StatusBadge
                  value="x"
                  options={{
                    x: { label: t('evaluation.evaluated'), tone: 'default' },
                  }}
                />
              ) : null}
            </span>
          ),
        }),
        detailColumns.accessor('recall', {
          header: t('evaluation.detailColumns.recall'),
          cell: (info) => score(info.getValue()),
        }),
        detailColumns.accessor('reciprocalRank', {
          header: t('evaluation.detailColumns.mrr'),
          cell: (info) => score(info.getValue()),
        }),
        detailColumns.accessor('ndcg', {
          header: t('evaluation.detailColumns.ndcg'),
          cell: (info) => score(info.getValue()),
        }),
        detailColumns.accessor('correctEmpty', {
          header: t('evaluation.detailColumns.correctEmpty'),
          cell: (info) => {
            const value = info.getValue();
            return value === undefined
              ? '—'
              : value
                ? t('evaluation.yes')
                : t('evaluation.no');
          },
        }),
        detailColumns.accessor('latencyMs', {
          header: t('evaluation.detailColumns.latency'),
          cell: (info) => latencyText(info.getValue(), t),
        }),
        detailColumns.accessor('retrievedSourceIds', {
          header: t('evaluation.detailColumns.sources'),
          cell: (info) => (
            <span className="rag:font-mono rag:text-xs rag:break-all">
              {info.getValue().join(t('evaluation.sourceSeparator')) ||
                t('evaluation.none')}
            </span>
          ),
        }),
      ]),
    [t],
  );
  return (
    <div className="rag:flex rag:flex-col rag:gap-4">
      <DescriptionList
        items={[
          {
            label: t('evaluation.fileName'),
            value: <span className="rag:break-all">{fileName}</span>,
          },
          {
            label: t('evaluation.mode'),
            value: t(`evaluation.modes.${report.provenance.mode}`),
          },
          {
            label: t('evaluation.evaluatedAt'),
            value: report.provenance.evaluatedAt,
          },
          {
            label: t('evaluation.gate'),
            value: (
              <StatusBadge
                value={report.gate.passed ? 'passed' : 'failed'}
                options={{
                  passed: { label: t('evaluation.passed'), tone: 'success' },
                  failed: {
                    label: t('evaluation.failed'),
                    tone: 'destructive',
                  },
                }}
              />
            ),
          },
          {
            label: t('evaluation.questions'),
            value: `${report.questionCount} / ${report.positiveCount} / ${report.negativeCount}`,
          },
          { label: `Recall@${report.k}`, value: score(report.recallAtK) },
          { label: `MRR@${report.k}`, value: score(report.mrrAtK) },
          { label: `nDCG@${report.k}`, value: score(report.ndcgAtK) },
          {
            label: t('evaluation.latency'),
            value: `${latency(report.latencyP50Ms)} / ${latency(report.latencyP95Ms)}`,
          },
          {
            label: t('evaluation.latencySamples'),
            value: report.latencySampleCount,
          },
          {
            label: t('evaluation.errorsMissing'),
            value: `${report.errorCount} / ${report.missingPredictionCount}`,
          },
          {
            label: t('evaluation.falseCounts'),
            value: `${report.falseNegativeCount} / ${report.falsePositiveCount}`,
          },
          {
            label: t('evaluation.correctEmpty'),
            value: report.correctEmptyCount,
          },
          {
            label: t('evaluation.scopeUnknown'),
            value: `${report.scopeLeakCount} / ${report.unknownSourceCount}`,
          },
          {
            label: t('evaluation.datasetSha'),
            value: (
              <span className="rag:font-mono rag:text-xs rag:break-all">
                {report.provenance.datasetSha256}
              </span>
            ),
          },
          {
            label: t('evaluation.corpusSha'),
            value: (
              <span className="rag:font-mono rag:text-xs rag:break-all">
                {report.provenance.corpusSha256}
              </span>
            ),
          },
        ]}
      />
      <CheckBadges
        checks={report.gate.checks}
        label={(key) =>
          t(
            `evaluation.checks.${key as keyof EvaluationReport['gate']['checks']}`,
          )
        }
      />
      <Notice
        tone="warning"
        title={t('evaluation.scoreNoteTitle')}
        description={t('evaluation.scoreNote')}
      />
      <DataTable
        caption={t('evaluation.title')}
        columns={columns}
        data={report.details.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
        rowKey={(row) => row.id}
        pagination={
          report.details.length > PAGE_SIZE
            ? {
                page,
                size: PAGE_SIZE,
                total: report.details.length,
                pageSizeOptions: [PAGE_SIZE],
                onChange: (next) => setPage(next),
              }
            : undefined
        }
      />
    </div>
  );
}

type LiveMetric = Exclude<
  keyof LiveEvaluationReport['results']['dense'],
  'errorCodes' | 'k' | 'schemaVersion'
>;
type MetricRow = {
  key: string;
  label: string;
  dense: string;
  hybrid: string;
  delta: string;
};
const METRICS: Array<{ key: LiveMetric; decimals?: number; unit?: boolean }> = [
  { key: 'questionCount' },
  { key: 'positiveCount' },
  { key: 'negativeCount' },
  { key: 'recallAtK', decimals: 4 },
  { key: 'mrrAtK', decimals: 4 },
  { key: 'ndcgAtK', decimals: 4 },
  { key: 'falseNegativeCount' },
  { key: 'falsePositiveCount' },
  { key: 'correctEmptyCount' },
  { key: 'latencyP50Ms', decimals: 1, unit: true },
  { key: 'latencyP95Ms', decimals: 1, unit: true },
  { key: 'latencySampleCount' },
  { key: 'errorCount' },
  { key: 'missingPredictionCount' },
  { key: 'timeoutCount' },
  { key: 'scopeLeakCount' },
  { key: 'blockedScopeViolationCount' },
  { key: 'unknownSourceCount' },
  { key: 'degradedCount' },
  { key: 'modeMismatchCount' },
];
const metricColumns = createDataTableColumns<MetricRow>();

function metricLabel(key: LiveMetric, k: number, t: TFunction<'rag'>) {
  if (key === 'recallAtK') return `Recall@${k}`;
  if (key === 'mrrAtK') return `MRR@${k}`;
  if (key === 'ndcgAtK') return `nDCG@${k}`;
  return t(
    `evaluation.live.metrics.${key as Exclude<LiveMetric, 'recallAtK' | 'mrrAtK' | 'ndcgAtK'>}`,
  );
}

function LiveReport({
  report,
  fileName,
}: {
  report: LiveEvaluationReport;
  fileName: string;
}) {
  const { t } = useTranslation('rag');
  const { dense, hybrid } = report.results;
  const rows = METRICS.map((item): MetricRow => {
    const format = (value: number | null | undefined, signed = false) =>
      value === null || value === undefined
        ? '—'
        : `${signed && value > 0 ? '+' : ''}${value.toFixed(item.decimals ?? 0)}${item.unit ? ' ms' : ''}`;
    const delta =
      report.hybridMinusDense[item.key as keyof typeof report.hybridMinusDense];
    return {
      key: item.key,
      label: metricLabel(item.key, dense.k, t),
      dense: format(dense[item.key] as number | null),
      hybrid: format(hybrid[item.key] as number | null),
      delta: delta === undefined ? '—' : format(delta, true),
    };
  });
  const columns = metricColumns.columns([
    metricColumns.accessor('label', { header: t('evaluation.live.metric') }),
    metricColumns.accessor('dense', { header: t('evaluation.live.dense') }),
    metricColumns.accessor('hybrid', { header: t('evaluation.live.hybrid') }),
    metricColumns.accessor('delta', { header: t('evaluation.live.delta') }),
  ]);
  const errorClasses = (mode: 'dense' | 'hybrid') =>
    Object.entries(report.results[mode].errorCodes)
      .map(([code, count]) => t('evaluation.live.errorCount', { code, count }))
      .join(t('evaluation.live.errorSeparator')) || t('evaluation.none');
  return (
    <div className="rag:flex rag:flex-col rag:gap-4">
      <DescriptionList
        items={[
          {
            label: t('evaluation.fileName'),
            value: <span className="rag:break-all">{fileName}</span>,
          },
          { label: t('evaluation.mode'), value: t('evaluation.live.mode') },
          {
            label: t('evaluation.live.status'),
            value: (
              <StatusBadge
                value={report.status}
                options={{
                  completed: {
                    label: t('evaluation.live.completed'),
                    tone: 'success',
                  },
                  failed: {
                    label: t('evaluation.live.runFailed'),
                    tone: 'destructive',
                  },
                }}
              />
            ),
          },
          { label: t('evaluation.live.startedAt'), value: report.startedAt },
          { label: t('evaluation.live.finishedAt'), value: report.finishedAt },
          {
            label: t('evaluation.live.acceptance'),
            value: (
              <StatusBadge
                value={report.acceptance.passed ? 'passed' : 'failed'}
                options={{
                  passed: { label: t('evaluation.passed'), tone: 'success' },
                  failed: {
                    label: t('evaluation.failed'),
                    tone: 'destructive',
                  },
                }}
              />
            ),
          },
          ...(report.errorCode
            ? [
                {
                  label: t('evaluation.live.errorCode'),
                  value: report.errorCode,
                },
              ]
            : []),
        ]}
      />
      <DataTable
        caption={t('evaluation.title')}
        columns={columns}
        data={rows}
        rowKey={(row) => row.key}
      />
      <CheckBadges
        checks={report.acceptance.checks}
        label={(key) => t(`evaluation.liveChecks.${key as LiveCheck}`)}
      />
      <DescriptionList
        items={[
          {
            label: t('evaluation.live.cleanup'),
            value: (
              <StatusBadge
                value={
                  report.cleanup.verifiedAbsent
                    ? 'absent'
                    : report.cleanup.required
                      ? 'unconfirmed'
                      : 'none'
                }
                options={{
                  absent: {
                    label: t('evaluation.live.verifiedAbsent'),
                    tone: 'success',
                  },
                  unconfirmed: {
                    label: t('evaluation.live.cleanupUnconfirmed'),
                    tone: 'warning',
                  },
                  none: {
                    label: t('evaluation.live.cleanupNotNeeded'),
                    tone: 'warning',
                  },
                }}
              />
            ),
          },
          {
            label: t('evaluation.live.cleanupAttempted'),
            value: report.cleanup.attempted
              ? t('evaluation.yes')
              : t('evaluation.no'),
          },
          {
            label: t('evaluation.live.cleanupStatus'),
            value: `${report.cleanup.deleteStatus ?? '—'} / ${report.cleanup.readbackStatus ?? '—'}`,
          },
          {
            label: t('evaluation.live.cleanupError'),
            value: report.cleanup.errorCode || t('evaluation.none'),
          },
          ...(['dense', 'hybrid'] as const).map((mode) => ({
            label: t('evaluation.live.errorClasses', {
              mode:
                mode === 'dense'
                  ? t('evaluation.live.dense')
                  : t('evaluation.live.hybrid'),
            }),
            value: errorClasses(mode),
          })),
        ]}
      />
      <Notice
        tone="warning"
        title={t('evaluation.live.noteTitle')}
        description={t('evaluation.live.note')}
      />
    </div>
  );
}

/**
 * 检索评估报告（照 1.2.4 的 EvaluationReportModal）：只在本浏览器读本地 JSON 报告，不上传、不保存；
 * 两种格式（评估器报告、live_compare 比较报告）自动识别；读错误只给原因，不回显报告内容。
 */
export function EvaluationReportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('rag');
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
  const read = async (file: File) => {
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
      )
        throw new EvaluationReportError('tooLarge');
      const parsed = readEvaluationReport(await file.text());
      if (current !== generation.current) return;
      setReport(parsed);
      setFileName(file.name);
    } catch (cause) {
      if (current !== generation.current) return;
      setError(
        cause instanceof EvaluationReportError
          ? cause.code === 'tooLarge' &&
            !(file.size > MAX_EVALUATION_REPORT_BYTES)
            ? t('evaluation.errors.invalidFile')
            : t(`evaluation.errors.${cause.code}`)
          : t('evaluation.errors.readFailed'),
      );
    } finally {
      if (current === generation.current) setReading(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="rag:max-h-[90vh] rag:overflow-y-auto rag:sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('evaluation.title')}</DialogTitle>
          <DialogDescription>
            {t('evaluation.localOnlyTitle')}
          </DialogDescription>
        </DialogHeader>
        <div className="rag:flex rag:flex-col rag:gap-4">
          <Notice
            tone="info"
            title={t('evaluation.localOnlyTitle')}
            description={t('evaluation.localOnlyDescription')}
          />
          <UploadDropzone
            label={t('evaluation.choose')}
            accept=".json,application/json"
            disabled={reading}
            onFiles={(files) => {
              if (files[0]) void read(files[0]);
            }}
          />
          {error ? <Notice tone="error" title={error} /> : null}
          {report ? (
            'kind' in report ? (
              <LiveReport report={report} fileName={fileName} />
            ) : (
              <OfflineReport report={report} fileName={fileName} />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
