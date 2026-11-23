import {
  Badge,
  Button,
  createDataTableColumns,
  DataTable,
  StatusBadge,
  type StatusTone,
} from '@admin-web/ui';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  StorageCapabilitiesVO,
  StorageConfigurationVO,
  StorageList,
} from '../../services/types.ts';
import { StorageTimestamp } from './StorageTimestamp.tsx';
import {
  probeState,
  runtimeState,
  type StorageProbeState,
  type StorageRuntimeState,
} from './storageModel.ts';

export type StorageRowIntent = {
  action: 'DELETE' | 'PROBE' | 'TOGGLE' | 'DEFAULT';
  row: StorageConfigurationVO;
};

const RUNTIME_TONES: Record<StorageRuntimeState, StatusTone> = {
  FAILED: 'destructive',
  APPLIED: 'success',
  PENDING: 'warning',
};

const PROBE_TONES: Record<StorageProbeState, StatusTone> = {
  NOT_CHECKED: 'default',
  STALE: 'warning',
  FAILED: 'destructive',
  SUCCEEDED: 'success',
  RUNNING: 'warning',
  UNKNOWN: 'warning',
};

const helper = createDataTableColumns<StorageConfigurationVO>();

const Muted = ({ children }: { children: ReactNode }) => (
  <div className="ai:text-xs ai:text-muted-foreground">{children}</div>
);

/**
 * 已保存的存储配置（照 1.2.4 的 StorageConfigurationTable）：保存、生效与探测的版本分开显示；
 * 默认配置或有文件引用的不能删除，生效的不是当前保存版本时不能探测或设为默认。
 */
export function StorageConfigurationTable({
  list,
  capabilities,
  writable,
  loading,
  onPage,
  onEdit,
  onIntent,
}: {
  list: StorageList;
  capabilities: StorageCapabilitiesVO;
  writable: boolean;
  loading: boolean;
  onPage: (page: number, size: number) => void;
  onEdit: (row: StorageConfigurationVO) => void;
  onIntent: (intent: StorageRowIntent) => void;
}) {
  const { t } = useTranslation('ai');
  const columns = useMemo(() => {
    const options = <S extends string>(
      tones: Record<S, StatusTone>,
      label: (state: S) => string,
    ) =>
      Object.fromEntries(
        (Object.keys(tones) as S[]).map((state) => [
          state,
          { label: label(state), tone: tones[state] },
        ]),
      );
    const runtime = options(RUNTIME_TONES, (state) =>
      t(`storage.runtime.${state}`),
    );
    const probe = options(PROBE_TONES, (state) => t(`storage.probe.${state}`));
    const providerLabel = (row: StorageConfigurationVO) =>
      capabilities.providers.find((entry) => entry.code === row.provider)
        ?.label || row.provider;
    return helper.columns([
      helper.display({
        id: 'identity',
        header: t('storage.table.identity'),
        cell: ({ row: { original: row } }) => (
          <div className="ai:flex ai:flex-col ai:items-start ai:gap-1 ai:break-all">
            <span className="ai:flex ai:flex-wrap ai:items-center ai:gap-1">
              <span className="ai:font-medium">{row.name}</span>
              {row.isDefault ? (
                <Badge>{t('storage.table.default')}</Badge>
              ) : null}
            </span>
            <Muted>{row.platform}</Muted>
            <Badge variant="outline">{providerLabel(row)}</Badge>
          </div>
        ),
      }),
      helper.display({
        id: 'location',
        header: t('storage.table.location'),
        cell: ({ row: { original: row } }) => (
          <div className="ai:break-all">
            <div>{row.bucket}</div>
            <Muted>{row.endpoint}</Muted>
            {row.region ? <Muted>{row.region}</Muted> : null}
          </div>
        ),
      }),
      helper.display({
        id: 'state',
        header: t('storage.table.state'),
        cell: ({ row: { original: row } }) => (
          <div className="ai:flex ai:flex-col ai:items-start ai:gap-1">
            <Badge variant={row.uploadEnabled ? 'default' : 'secondary'}>
              {row.uploadEnabled
                ? t('storage.list.uploadEnabled')
                : t('storage.list.uploadDisabled')}
            </Badge>
            <StatusBadge value={runtimeState(row)} options={runtime} />
            <Muted>
              {t('storage.table.revisions', {
                saved: row.configRevision,
                applied:
                  row.appliedRevision === null
                    ? t('storage.table.appliedUnknown')
                    : t('storage.table.appliedRevision', {
                        revision: row.appliedRevision,
                      }),
              })}
            </Muted>
          </div>
        ),
      }),
      helper.display({
        id: 'credentials',
        header: t('storage.table.credentials'),
        cell: ({ row: { original: row } }) => (
          <div>
            <div>
              {row.credentialsConfigured
                ? t('storage.table.credentialsConfigured')
                : t('storage.table.credentialsMissing')}
            </div>
            <Muted>
              {t('storage.table.references', { count: row.referenceCount })}
            </Muted>
          </div>
        ),
      }),
      helper.display({
        id: 'probe',
        header: t('storage.table.probe'),
        cell: ({ row: { original: row } }) => (
          <div className="ai:flex ai:flex-col ai:items-start ai:gap-1">
            <StatusBadge value={probeState(row)} options={probe} />
            {row.lastProbe ? (
              <>
                <Muted>
                  {t('storage.table.probeRevision', {
                    revision: row.lastProbe.checkedRevision,
                  })}
                </Muted>
                <Muted>
                  <StorageTimestamp
                    value={row.lastProbe.finishedAt}
                    fallback={t('storage.table.probeUnfinished')}
                  />
                </Muted>
              </>
            ) : null}
          </div>
        ),
      }),
      helper.display({
        id: 'actions',
        header: t('storage.table.actions'),
        cell: ({ row: { original: row } }) => {
          const applied = runtimeState(row) === 'APPLIED';
          const undeletable = row.isDefault
            ? t('storage.table.defaultUndeletable')
            : row.referenceCount > 0
              ? t('storage.table.referencedUndeletable')
              : undefined;
          return (
            <div className="ai:flex ai:flex-wrap ai:gap-x-1">
              <Button
                variant="link"
                size="sm"
                disabled={!writable}
                onClick={() => onEdit(row)}
              >
                {t('storage.table.edit')}
              </Button>
              <Button
                variant="link"
                size="sm"
                disabled={!writable || !row.credentialsConfigured || !applied}
                onClick={() => onIntent({ action: 'PROBE', row })}
              >
                {t('storage.table.probeAction')}
              </Button>
              <Button
                variant="link"
                size="sm"
                disabled={!writable}
                onClick={() => onIntent({ action: 'TOGGLE', row })}
              >
                {row.uploadEnabled
                  ? t('storage.table.disableUpload')
                  : t('storage.table.enableUpload')}
              </Button>
              <Button
                variant="link"
                size="sm"
                disabled={
                  !writable || row.isDefault || !row.uploadEnabled || !applied
                }
                onClick={() => onIntent({ action: 'DEFAULT', row })}
              >
                {t('storage.table.makeDefault')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="ai:text-destructive"
                disabled={!writable || !!undeletable}
                title={undeletable}
                onClick={() => onIntent({ action: 'DELETE', row })}
              >
                {t('storage.table.delete')}
              </Button>
            </div>
          );
        },
      }),
    ]);
  }, [t, capabilities, writable, onEdit, onIntent]);

  return (
    <DataTable
      caption={t('storage.list.title')}
      columns={columns}
      data={list.items}
      rowKey={(row) => row.id}
      loading={loading}
      emptyText={t('storage.list.empty')}
      pagination={{
        page: list.page,
        size: list.size,
        total: list.total,
        pageSizeOptions: [20, 50, 100],
        // 有未确认的操作或正在读写时不翻页（翻页会重新读取）。
        onChange: (page, size) => {
          if (writable) onPage(page, size);
        },
      }}
    />
  );
}
