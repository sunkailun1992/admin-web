import { useAllows, useSession } from '@admin-web/auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  PageContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@admin-web/ui';
import { Plus, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as rules from '../../access.ts';
import { Notice } from '../../components/Notice.tsx';
import { Section } from '../../components/Section.tsx';
import {
  createStorageConfiguration,
  deleteStorageConfiguration,
  getStorageCapabilities,
  getStorageOperation,
  getStorageSettings,
  listStorageConfigurations,
  probeStorageConfiguration,
  updateStorageConfiguration,
  updateStorageSettings,
} from '../../services/storage.ts';
import type {
  StorageAction,
  StorageConfigurationVO,
  StorageListQuery,
  StorageProvider,
} from '../../services/types.ts';
import {
  StorageConfigurationSheet,
  type StorageFormValues,
} from './StorageConfigurationSheet.tsx';
import {
  StorageConfigurationTable,
  type StorageRowIntent,
} from './StorageConfigurationTable.tsx';
import {
  createPayload,
  createStorageController,
  createStoragePendingStore,
  createStorageRequestId,
  readStorageSnapshot,
  settingsPayload,
  updatePayload,
  type StorageController,
  type StorageState,
} from './storageModel.ts';
import { StorageOperationSheet } from './StorageOperationSheet.tsx';
import {
  StorageSettingsPanel,
  type StorageSettingsValues,
} from './StorageSettingsPanel.tsx';
import { storageErrorText } from './storageText.ts';

/** 校验表单时占位的请求标识（真正提交时由控制器换成新生成的标识）。 */
const VALIDATION_KEY = '00000000-0000-4000-8000-000000000000';
const ALL = '__all__';

type Invoke = Parameters<StorageController['submit']>[2];

/** 会话存储不可用（隐私模式等）时：读不到恢复标识就阻止提交，避免不知情地重复未知操作。 */
function pendingStore(scope: string) {
  try {
    return createStoragePendingStore(window.sessionStorage, scope);
  } catch {
    return {
      load: () => {
        throw new Error('SESSION_STORAGE_UNAVAILABLE');
      },
      save: () => {},
      clear: () => {},
    };
  }
}

function StorageWorkbench({
  scope,
  liveScope,
  canManage,
}: {
  scope: string;
  liveScope: () => string;
  canManage: () => boolean;
}) {
  const { t } = useTranslation('ai');
  const { t: tc } = useTranslation('common');
  const controller = useRef<StorageController>(undefined);
  const [state, setState] = useState<StorageState>({ phase: 'idle' });
  const [query, setQuery] = useState<StorageListQuery>({ page: 1, size: 20 });
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ current?: StorageConfigurationVO }>();
  const [intent, setIntent] = useState<StorageRowIntent>();
  const [operationOpen, setOperationOpen] = useState(false);
  const [formError, setFormError] = useState<'form' | 'settings'>();

  useEffect(() => {
    const current = createStorageController({
      scope,
      liveScope,
      canManage,
      store: pendingStore(scope),
      requestId: () => createStorageRequestId(),
      read: (next, options) =>
        readStorageSnapshot(next, options, {
          list: listStorageConfigurations,
          settings: getStorageSettings,
          capabilities: getStorageCapabilities,
        }),
      lookup: getStorageOperation,
      changed: setState,
    });
    controller.current = current;
    void current.load();
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = undefined;
    };
  }, [scope, liveScope, canManage]);

  // 出现新的待查回操作（请求标识变了）就打开操作详情；用户关掉后，同一个操作不再自动打开。
  const pendingRequestId = state.pending?.requestId;
  const [seenPendingId, setSeenPendingId] = useState(pendingRequestId);
  if (seenPendingId !== pendingRequestId) {
    setSeenPendingId(pendingRequestId);
    if (pendingRequestId) setOperationOpen(true);
  }

  const snapshot = state.snapshot;
  const busy = ['idle', 'loading', 'submitting', 'checking'].includes(
    state.phase,
  );
  const writable = state.phase === 'ready' && !state.pending && canManage();
  const load = (next: StorageListQuery) => {
    setQuery(next);
    void controller.current?.load(next);
  };
  const filtered = (next: Partial<StorageListQuery>) =>
    load({
      page: 1,
      size: query.size,
      search: search.trim() || undefined,
      provider: query.provider,
      uploadEnabled: query.uploadEnabled,
      ...next,
    });

  const submit = (action: StorageAction, id: string | null, invoke: Invoke) => {
    if (!controller.current?.canSubmit()) return false;
    setFormError(undefined);
    setOperationOpen(true);
    void controller.current.submit(action, id, invoke, true);
    return true;
  };

  const saveConfiguration = (values: StorageFormValues) => {
    if (!snapshot || !editor || !writable) return false;
    try {
      const row = editor.current;
      if (row) {
        const payload = updatePayload(values, row, VALIDATION_KEY);
        if (
          !submit('UPDATE', row.id, (requestId, options) =>
            updateStorageConfiguration(
              row.id,
              { ...payload, requestId },
              options,
            ),
          )
        )
          return false;
      } else {
        const payload = createPayload(
          values,
          snapshot.capabilities,
          VALIDATION_KEY,
        );
        if (
          !submit('CREATE', null, (requestId, options) =>
            createStorageConfiguration({ ...payload, requestId }, options),
          )
        )
          return false;
      }
      setEditor(undefined);
      return true;
    } catch {
      setFormError('form');
      return false;
    }
  };

  const saveSettings = (values: StorageSettingsValues) => {
    if (!snapshot || !writable) return false;
    try {
      const payload = settingsPayload(
        values,
        snapshot.settings,
        snapshot.capabilities,
        VALIDATION_KEY,
        snapshot.defaultPlatforms,
      );
      return submit('UPDATE_SETTINGS', null, (requestId, options) =>
        updateStorageSettings({ ...payload, requestId }, options),
      );
    } catch {
      setFormError('settings');
      return false;
    }
  };

  const confirmIntent = () => {
    if (!intent || !snapshot || !writable) return;
    const { row, action } = intent;
    if (action === 'DELETE') {
      if (row.isDefault || row.referenceCount > 0) return;
      submit('DELETE', row.id, (requestId, options) =>
        deleteStorageConfiguration(
          row.id,
          { requestId, expectedVersion: row.version },
          options,
        ),
      );
    } else if (action === 'PROBE')
      submit('PROBE', row.id, (requestId, options) =>
        probeStorageConfiguration(
          row.id,
          { requestId, expectedVersion: row.version, mode: 'READ_WRITE' },
          options,
        ),
      );
    else if (action === 'TOGGLE')
      submit('UPDATE', row.id, (requestId, options) =>
        updateStorageConfiguration(
          row.id,
          {
            requestId,
            expectedVersion: row.version,
            name: row.name,
            uploadEnabled: !row.uploadEnabled,
            credentialAction: 'KEEP',
          },
          options,
        ),
      );
    else
      saveSettings({
        defaultPlatform: row.platform,
        uploadTtlSeconds: snapshot.settings.uploadTtlSeconds,
        viewTtlSeconds: snapshot.settings.viewTtlSeconds,
        maxUploadBytes: snapshot.settings.maxUploadBytes,
      });
    setIntent(undefined);
  };

  const intentTitle = !intent
    ? ''
    : intent.action === 'TOGGLE'
      ? intent.row.uploadEnabled
        ? t('storage.intent.titles.DISABLE')
        : t('storage.intent.titles.ENABLE')
      : t(`storage.intent.titles.${intent.action}`);
  const intentWarning =
    intent?.action === 'PROBE'
      ? t('storage.intent.probeWarning')
      : intent?.action === 'DELETE'
        ? t('storage.intent.deleteWarning')
        : t('storage.intent.uploadWarning');
  const canCreate =
    writable &&
    !!snapshot?.capabilities.providers.some(
      (entry) => entry.availability === 'AVAILABLE',
    );

  return (
    <PageContainer
      title={t('storage.title')}
      extra={
        <>
          <Button
            variant="outline"
            aria-busy={busy}
            disabled={state.phase === 'submitting' || state.phase === 'blocked'}
            onClick={() => void controller.current?.load(query)}
          >
            <RefreshCw
              aria-hidden="true"
              className={busy ? 'ai:animate-spin' : undefined}
            />
            {state.pending ? t('storage.readback') : t('storage.refresh')}
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() => {
              setFormError(undefined);
              setEditor({});
            }}
          >
            <Plus aria-hidden="true" />
            {t('storage.create')}
          </Button>
        </>
      }
    >
      <p className="ai:-mt-2 ai:text-sm ai:text-muted-foreground">
        {t('storage.subtitle')}
      </p>
      <Notice
        tone="info"
        title={t('storage.introTitle')}
        description={t('storage.introDescription')}
      />
      {state.error ? (
        <Notice
          tone={
            state.pending || state.phase === 'blocked' ? 'warning' : 'error'
          }
          title={storageErrorText(state.error, t)}
          action={
            state.pending ? (
              <Button
                size="sm"
                variant="outline"
                aria-busy={state.phase === 'checking'}
                disabled={
                  state.phase === 'blocked' || state.phase === 'submitting'
                }
                onClick={() => void controller.current?.lookup()}
              >
                {t('storage.readback')}
              </Button>
            ) : state.phase !== 'blocked' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void controller.current?.load(query)}
              >
                {t('storage.retry')}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {formError ? (
        <Notice
          tone="error"
          title={
            formError === 'form'
              ? t('storage.formInvalid')
              : t('storage.settingsInvalid')
          }
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFormError(undefined)}
            >
              <X aria-hidden="true" />
              {t('storage.dismiss')}
            </Button>
          }
        />
      ) : null}
      {state.pending ? (
        <Notice
          tone="warning"
          title={t('storage.pendingTitle')}
          description={t('storage.pendingDescription')}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOperationOpen(true)}
            >
              {t('storage.viewPending')}
            </Button>
          }
        />
      ) : null}
      {!snapshot && busy ? (
        <div className="ai:flex ai:flex-col ai:gap-3 ai:rounded-xl ai:border ai:p-6">
          <Skeleton className="ai:h-4 ai:w-48" />
          <Skeleton className="ai:h-4 ai:w-full" />
          <Skeleton className="ai:h-4 ai:w-full" />
        </div>
      ) : null}
      {snapshot ? (
        <>
          <StorageSettingsPanel
            settings={snapshot.settings}
            capabilities={snapshot.capabilities}
            defaultPlatforms={snapshot.defaultPlatforms}
            disabled={!writable}
            onSubmit={saveSettings}
          />
          <Section
            title={t('storage.list.title')}
            extra={
              state.operation ? (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setOperationOpen(true)}
                >
                  {t('storage.list.recent')}
                </Button>
              ) : null
            }
          >
            <div className="ai:flex ai:flex-wrap ai:gap-2">
              <form
                role="search"
                className="ai:flex ai:gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  filtered({});
                }}
              >
                <Input
                  type="search"
                  aria-label={t('storage.list.search')}
                  placeholder={t('storage.list.searchPlaceholder')}
                  value={search}
                  disabled={!writable}
                  onChange={(event) => setSearch(event.target.value)}
                  className="ai:w-full ai:sm:w-64"
                />
                <Button type="submit" variant="outline" disabled={!writable}>
                  {t('storage.list.searchAction')}
                </Button>
              </form>
              <Select
                value={query.provider ?? ALL}
                disabled={!writable}
                onValueChange={(value) =>
                  filtered({
                    provider:
                      value === ALL ? undefined : (value as StorageProvider),
                  })
                }
              >
                <SelectTrigger
                  aria-label={t('storage.list.provider')}
                  className="ai:w-full ai:sm:w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    {t('storage.list.allProviders')}
                  </SelectItem>
                  {snapshot.capabilities.providers.map((entry) => (
                    <SelectItem key={entry.code} value={entry.code}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={
                  query.uploadEnabled === undefined
                    ? ALL
                    : String(query.uploadEnabled)
                }
                disabled={!writable}
                onValueChange={(value) =>
                  filtered({
                    uploadEnabled: value === ALL ? undefined : value === 'true',
                  })
                }
              >
                <SelectTrigger
                  aria-label={t('storage.list.upload')}
                  className="ai:w-full ai:sm:w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    {t('storage.list.allUploads')}
                  </SelectItem>
                  <SelectItem value="true">
                    {t('storage.list.uploadEnabled')}
                  </SelectItem>
                  <SelectItem value="false">
                    {t('storage.list.uploadDisabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <StorageConfigurationTable
              list={snapshot.list}
              capabilities={snapshot.capabilities}
              writable={writable}
              loading={state.phase === 'loading'}
              onPage={(page, size) => load({ ...query, page, size })}
              onEdit={(row) => {
                setFormError(undefined);
                setEditor({ current: row });
              }}
              onIntent={setIntent}
            />
          </Section>
          {editor ? (
            <StorageConfigurationSheet
              current={editor.current}
              capabilities={snapshot.capabilities}
              disabled={!writable}
              onClose={() => {
                setEditor(undefined);
                setFormError(undefined);
              }}
              onSubmit={saveConfiguration}
            />
          ) : null}
        </>
      ) : null}
      <StorageOperationSheet
        open={operationOpen}
        state={state}
        onClose={() => setOperationOpen(false)}
        onLookup={() => void controller.current?.lookup()}
      />
      <AlertDialog
        open={!!intent}
        onOpenChange={(open) => {
          if (!open) setIntent(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{intentTitle}</AlertDialogTitle>
            <AlertDialogDescription className="ai:break-all">
              {intent?.row.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Notice tone="warning" title={intentWarning} />
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant={intent?.action === 'DELETE' ? 'destructive' : 'default'}
              disabled={!writable}
              onClick={confirmIntent}
            >
              {t('storage.intent.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

/**
 * 统一配置的“文件存储”页（canManageConfiguration）：身份或权限变了就整个重建工作台，
 * 进行中的请求不再发布结果；恢复标识按身份分开保存。
 */
export default function StorageConfigurationPage() {
  const { t } = useTranslation('ai');
  const { currentUser, currentTenantId } = useSession();
  const canManageConfiguration = useAllows(rules.canManageConfiguration);
  const userId = currentUser?.userId;
  const tenantId = currentTenantId || currentUser?.tenantId;
  const allowed = canManageConfiguration && !!userId && !!tenantId;
  const scope = allowed ? JSON.stringify([userId, tenantId, true]) : '';
  const scopeRef = useRef(scope);
  const allowedRef = useRef(allowed);
  useEffect(() => {
    scopeRef.current = scope;
    allowedRef.current = allowed;
  }, [scope, allowed]);
  // 给工作台的读取函数要稳定，它的 effect 才能把它们列进依赖、又不会每次渲染都重建控制器。
  const liveScope = useCallback(() => scopeRef.current, []);
  const canManage = useCallback(() => allowedRef.current, []);
  if (!allowed)
    return (
      <PageContainer title={t('storage.title')}>
        <Notice tone="warning" title={t('configurationForbidden')} />
      </PageContainer>
    );
  return (
    <StorageWorkbench
      key={scope}
      scope={scope}
      liveScope={liveScope}
      canManage={canManage}
    />
  );
}
