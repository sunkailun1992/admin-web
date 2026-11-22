import {
  Badge,
  createDataTableColumns,
  DataTable,
  DescriptionList,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  type StatusTone,
} from '@admin-web/ui';
import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../../components/Notice.tsx';
import { Section } from '../../components/Section.tsx';
import type {
  ModelCapability,
  ModelCatalogItem,
  ModelControlPlaneVO,
  ModelTaskBinding,
  ModelVerification,
} from '../../services/types.ts';
import {
  CAPABILITIES,
  catalogRowKey,
  consoleLinks,
  filterCatalog,
} from './controlPlane.ts';

const PAGE_SIZE = 10;
const ALL = '__all__';

const VERIFICATION_TONES: Record<ModelVerification, StatusTone> = {
  NOT_CHECKED: 'default',
  VERIFIED: 'success',
  FAILED: 'destructive',
  UNKNOWN: 'warning',
};

/** ISO 时间按原样显示（T 换成空格、Z 写成 UTC），缺失时写“未提供”。 */
const isoText = (value: string | null, missing: string) =>
  value ? value.replace('T', ' ').replace('Z', ' UTC') : missing;

const catalogColumns = createDataTableColumns<ModelCatalogItem>();
const bindingColumns = createDataTableColumns<ModelTaskBinding>();

/**
 * 模型管理目录（照 1.2.4 的 ModelControlPlaneView）：原生控制台入口、本环境的部署目录与业务任务绑定。
 * 只读；目录不可读时明确说明，不当成空目录。
 */
export function ModelControlPlaneView({ data }: { data: ModelControlPlaneVO }) {
  const { t } = useTranslation('ai');
  const [query, setQuery] = useState('');
  const [capability, setCapability] = useState<ModelCapability>();
  const [page, setPage] = useState(1);
  const links = consoleLinks(data.consoleBaseUrl);
  const rows = filterCatalog(data.modelCatalog, query, capability);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const verification = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(VERIFICATION_TONES) as ModelVerification[]).map(
          (value) => [
            value,
            {
              label: t(`controlPlane.verification.${value}`),
              tone: VERIFICATION_TONES[value],
            },
          ],
        ),
      ),
    [t],
  );

  const catalog = useMemo(
    () =>
      catalogColumns.columns([
        catalogColumns.accessor('modelName', {
          header: t('controlPlane.columns.modelName'),
          cell: (info) => <span className="break-all">{info.getValue()}</span>,
        }),
        catalogColumns.display({
          id: 'physical',
          header: t('controlPlane.columns.physical'),
          cell: ({ row }) => (
            <div className="break-all">
              <div>
                {row.original.provider || t('controlPlane.providerUnknown')}
              </div>
              <div className="text-muted-foreground">
                {row.original.model || t('controlPlane.modelUnknown')}
              </div>
            </div>
          ),
        }),
        catalogColumns.display({
          id: 'capabilities',
          header: t('controlPlane.columns.capabilities'),
          cell: ({ row }) => (
            <span className="flex flex-wrap gap-1">
              {row.original.capabilities.map((item) => (
                <Badge key={item} variant="secondary">
                  {t(`controlPlane.capabilities.${item}`)}
                </Badge>
              ))}
            </span>
          ),
        }),
        catalogColumns.accessor('contextWindow', {
          header: t('controlPlane.columns.contextWindow'),
          cell: (info) => {
            const value = info.getValue();
            return value
              ? t('controlPlane.tokens', { count: value.toLocaleString() })
              : t('controlPlane.notProvided');
          },
        }),
        catalogColumns.display({
          id: 'verification',
          header: t('controlPlane.columns.verification'),
          cell: ({ row }) => (
            <div className="flex flex-col items-start gap-1">
              <StatusBadge
                value={row.original.verificationStatus}
                options={verification}
              />
              {row.original.verifiedAt ? (
                <span className="text-xs text-muted-foreground">
                  {isoText(
                    row.original.verifiedAt,
                    t('controlPlane.notProvided'),
                  )}
                </span>
              ) : null}
            </div>
          ),
        }),
      ]),
    [t, verification],
  );

  const bindings = useMemo(
    () =>
      bindingColumns.columns([
        bindingColumns.accessor('taskName', {
          header: t('controlPlane.bindingColumns.task'),
        }),
        bindingColumns.accessor('capability', {
          header: t('controlPlane.bindingColumns.capability'),
          cell: (info) => t(`controlPlane.capabilities.${info.getValue()}`),
        }),
        bindingColumns.accessor('modelName', {
          header: t('controlPlane.bindingColumns.model'),
          cell: (info) => (
            <span className="break-all">
              {info.getValue() || t('controlPlane.bindingModelMissing')}
            </span>
          ),
        }),
        bindingColumns.display({
          id: 'status',
          header: t('controlPlane.bindingColumns.status'),
          cell: ({ row }) => (
            <div>
              <div>
                {t(`controlPlane.bindingStatus.${row.original.status}`)}
              </div>
              {row.original.reasonCode === 'RAG_INDEX_BOUND' ? (
                <div className="text-muted-foreground">
                  {t('controlPlane.indexBound')}
                </div>
              ) : row.original.readOnly ? (
                <div className="text-muted-foreground">
                  {t('controlPlane.businessManaged')}
                </div>
              ) : null}
            </div>
          ),
        }),
      ]),
    [t],
  );

  const filter = (next: { query?: string; capability?: ModelCapability }) => {
    if ('query' in next) setQuery(next.query ?? '');
    if ('capability' in next) setCapability(next.capability);
    setPage(1);
  };

  return (
    <>
      <Notice
        tone={data.available ? 'info' : 'warning'}
        title={
          data.available
            ? t('controlPlane.availableTitle')
            : data.status === 'NOT_CONFIGURED'
              ? t('controlPlane.notConfiguredTitle')
              : t('controlPlane.unreachableTitle')
        }
        description={t('controlPlane.availabilityDescription')}
      />
      <Section title={t('controlPlane.nativeTitle')}>
        <DescriptionList
          items={[
            {
              label: t('controlPlane.runtimeVersion'),
              value: data.platformVersion || t('controlPlane.versionMissing'),
            },
            {
              label: t('controlPlane.configSource'),
              value: t('controlPlane.configSourceValue'),
            },
            {
              label: t('controlPlane.checkedAt'),
              value: isoText(data.checkedAt, t('controlPlane.notProvided')),
            },
          ]}
        />
        {links.length ? (
          <nav aria-label={t('controlPlane.consoleNav')}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((link) => (
                <li key={link.key}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col gap-1 rounded-lg border p-4 text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-1 font-medium">
                      {t(`controlPlane.links.${link.key}.title`)}
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="text-muted-foreground">
                      {t(`controlPlane.links.${link.key}.description`)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('controlPlane.consoleMissing')}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {t('controlPlane.consoleHint')}
        </p>
      </Section>
      <Section
        title={t('controlPlane.catalogTitle')}
        extra={
          <span className="text-sm text-muted-foreground">
            {data.available
              ? t('controlPlane.catalogCount', {
                  deployments: new Set(data.modelCatalog.map((row) => row.id))
                    .size,
                  records: data.modelCatalog.length,
                })
              : t('controlPlane.catalogCountUnknown')}
          </span>
        }
      >
        <DataTable
          caption={t('controlPlane.catalogTitle')}
          columns={catalog}
          data={pageRows}
          rowKey={catalogRowKey}
          emptyText={
            !data.available
              ? t('controlPlane.emptyUnavailable')
              : data.modelCatalog.length
                ? t('controlPlane.emptyFiltered')
                : t('controlPlane.emptyCatalog')
          }
          pagination={
            rows.length > PAGE_SIZE
              ? {
                  page,
                  size: PAGE_SIZE,
                  total: rows.length,
                  pageSizeOptions: [PAGE_SIZE],
                  onChange: (next) => setPage(next),
                }
              : undefined
          }
          toolbar={
            <div className="flex flex-wrap gap-2">
              <Input
                type="search"
                aria-label={t('controlPlane.search')}
                placeholder={t('controlPlane.searchPlaceholder')}
                value={query}
                onChange={(event) => filter({ query: event.target.value })}
                className="w-full sm:w-72"
              />
              <Select
                value={capability ?? ALL}
                onValueChange={(value) =>
                  filter({
                    capability:
                      value === ALL ? undefined : (value as ModelCapability),
                  })
                }
              >
                <SelectTrigger
                  aria-label={t('controlPlane.capabilityFilter')}
                  className="w-full sm:w-48"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    {t('controlPlane.allCapabilities')}
                  </SelectItem>
                  {CAPABILITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`controlPlane.capabilities.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
        <p className="text-sm text-muted-foreground">
          {t('controlPlane.catalogHint')}
        </p>
      </Section>
      <Section
        title={t('controlPlane.bindingsTitle')}
        description={t('controlPlane.bindingsHint')}
      >
        <DataTable
          caption={t('controlPlane.bindingsTitle')}
          columns={bindings}
          data={data.taskBindings}
          rowKey={(row) => row.taskCode}
          emptyText={t('controlPlane.bindingsEmpty')}
        />
      </Section>
    </>
  );
}
