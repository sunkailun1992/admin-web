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
  DescriptionList,
  Field,
  FieldDescription,
  FieldLabel,
  PageContainer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@admin-web/ui';
import { RefreshCw } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../components/Notice.tsx';
import { Section } from '../components/Section.tsx';
import { getModelSelection, updateModelSelection } from '../services/model.ts';
import type { ModelProvider } from '../services/types.ts';
import { ModelRouteOverview } from './ModelRouteOverview.tsx';
import {
  canSelectProvider,
  createModelSelectionController,
  providerLabel,
  type ModelSelectionController,
  type ModelSelectionState,
} from './modelSelectionModel.ts';

/** 渲染后同步到 ref 的最新值：控制器回调里读，不必为它重建控制器。 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function Frame({
  embedded,
  title,
  description,
  extra,
  children,
}: {
  embedded: boolean;
  title: string;
  description: string;
  extra: ReactNode;
  children: ReactNode;
}) {
  if (embedded)
    return (
      <Section title={title} description={description} extra={extra}>
        {children}
      </Section>
    );
  return (
    <PageContainer title={title} extra={extra}>
      <p className="ai:-mt-2 ai:text-sm ai:text-muted-foreground">
        {description}
      </p>
      {children}
    </PageContainer>
  );
}

/**
 * 全局默认模型路由（照 1.2.4 的 ModelRouteWorkbench）：读当前路由与支持项；
 * 有 canChangeAiModel 才能改，改之前要二次确认；提交结果不明时只读查回，不重发。
 */
export function ModelRouteWorkbench({
  identityScope,
  canChange,
  embedded = false,
}: {
  identityScope: string;
  canChange: boolean;
  /** 嵌在统一配置的“模型与能力”页里（标题降一级）。 */
  embedded?: boolean;
}) {
  const { t } = useTranslation('ai');
  const { t: tc } = useTranslation('common');
  const targetId = useId();
  const scope = useLatest(identityScope);
  const allowed = useLatest(canChange);
  const controller = useRef<ModelSelectionController>(undefined);
  const [state, setState] = useState<ModelSelectionState>({ phase: 'idle' });
  const [candidate, setCandidate] = useState('');
  const [confirming, setConfirming] = useState<ModelProvider>();

  useEffect(() => {
    const current = createModelSelectionController({
      scope: identityScope,
      liveScope: () => scope.current,
      canChange: () => allowed.current,
      read: getModelSelection,
      write: updateModelSelection,
      changed: setState,
    });
    controller.current = current;
    void current.load();
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = undefined;
    };
  }, [identityScope, scope, allowed]);

  // 读到新的路由就清掉没提交的选择（React 文档：属性或状态变化时在渲染期按前值调整状态）。
  const selection = state.selection;
  const [shownSelection, setShownSelection] = useState(selection);
  if (shownSelection !== selection) {
    setShownSelection(selection);
    setCandidate('');
  }

  const busy = ['idle', 'loading', 'saving', 'checking'].includes(state.phase);
  const canEdit = canChange && state.phase === 'ready';
  const canSubmit = canSelectProvider(state, candidate || undefined, canChange);
  const uncertain = state.phase === 'uncertain';
  const supported = selection?.supportedProviders ?? [];
  const load = () => void controller.current?.load();
  const level = embedded ? 3 : 2;

  const refresh = (
    <Button
      variant="outline"
      disabled={state.phase === 'saving'}
      aria-busy={busy}
      onClick={load}
    >
      <RefreshCw
        aria-hidden="true"
        className={busy ? 'ai:animate-spin' : undefined}
      />
      {uncertain ? t('model.readback') : t('model.refresh')}
    </Button>
  );

  return (
    <Frame
      embedded={embedded}
      title={t('model.title')}
      description={t('model.subtitle')}
      extra={refresh}
    >
      {!canChange ? (
        <Notice
          tone="info"
          title={t('model.readOnlyTitle')}
          description={t('model.readOnlyDescription')}
        />
      ) : null}
      {state.error ? (
        <Notice
          tone={uncertain ? 'warning' : 'error'}
          title={
            state.phase === 'load-error'
              ? t('model.errorTitles.loadError')
              : uncertain
                ? t('model.errorTitles.uncertain')
                : t('model.errorTitles.failed')
          }
          description={t(`model.errors.${state.error}`)}
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={state.phase === 'saving'}
              onClick={load}
            >
              {uncertain ? t('model.readback') : t('model.retry')}
            </Button>
          }
        />
      ) : null}
      {state.phase === 'checking' ? (
        <Notice
          tone="warning"
          title={t('model.checkingTitle')}
          description={t('model.checkingDescription')}
        />
      ) : null}
      {state.notice === 'saved' ? (
        <Notice tone="success" title={t('model.savedTitle')} />
      ) : null}
      {state.notice === 'readback' ? (
        <Notice
          tone="info"
          title={t('model.readbackTitle')}
          description={t('model.readbackDescription')}
        />
      ) : null}
      {selection ? (
        <ModelRouteOverview
          selection={selection}
          stale={state.phase !== 'ready'}
          level={level}
        />
      ) : busy ? (
        <div className="ai:flex ai:flex-col ai:gap-3 ai:rounded-xl ai:border ai:p-6">
          <Skeleton className="ai:h-4 ai:w-32" />
          <Skeleton className="ai:h-8 ai:w-48" />
          <Skeleton className="ai:h-4 ai:w-full" />
        </div>
      ) : null}
      {canChange ? (
        <Section
          title={t('model.changeTitle')}
          level={level}
          description={t('model.changeDescription')}
          extra={
            <span className="ai:text-sm ai:text-muted-foreground">
              {t('model.changeScope')}
            </span>
          }
        >
          <Field>
            <FieldLabel htmlFor={targetId}>{t('model.target')}</FieldLabel>
            <Select
              value={candidate}
              onValueChange={setCandidate}
              disabled={!canEdit}
            >
              <SelectTrigger id={targetId} className="ai:w-full ai:sm:w-80">
                <SelectValue placeholder={t('model.targetPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {supported.map((provider) => (
                  <SelectItem
                    key={provider}
                    value={provider}
                    disabled={provider === selection?.provider}
                  >
                    {provider === selection?.provider
                      ? t('model.currentOption', {
                          label: providerLabel(provider, t),
                        })
                      : providerLabel(provider, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!supported.length ? (
              <FieldDescription>{t('model.needSupport')}</FieldDescription>
            ) : null}
          </Field>
          <div className="ai:flex ai:flex-wrap ai:gap-2">
            <Button
              disabled={!canSubmit}
              aria-busy={state.phase === 'saving'}
              onClick={() => {
                if (candidate && controller.current?.canSave(candidate))
                  setConfirming(candidate);
              }}
            >
              {t('model.confirmChange')}
            </Button>
            <Button
              variant="outline"
              disabled={!canEdit || !candidate}
              onClick={() => setCandidate('')}
            >
              {t('model.clearSelection')}
            </Button>
          </div>
        </Section>
      ) : null}
      <AlertDialog
        open={!!confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('model.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('model.confirmWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DescriptionList
            items={[
              {
                label: t('model.currentProvider'),
                value: selection
                  ? providerLabel(selection.provider, t)
                  : t('model.notRead'),
              },
              {
                label: t('model.currentModel'),
                value: (
                  <span className="ai:break-all">
                    {selection?.model || t('model.modelMissing')}
                  </span>
                ),
              },
              {
                label: t('model.targetProvider'),
                value: confirming ? providerLabel(confirming, t) : '-',
              },
            ]}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canSelectProvider(state, confirming, canChange)}
              onClick={() => {
                const provider = confirming;
                setConfirming(undefined);
                if (provider) void controller.current?.save(provider, true);
              }}
            >
              {t('model.confirmOk')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Frame>
  );
}
