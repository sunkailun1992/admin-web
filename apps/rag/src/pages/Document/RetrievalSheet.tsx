import {
  Badge,
  Button,
  EmptyState,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from '@admin-web/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Notice } from '../../components/Notice.tsx';
import {
  createDocumentRequestGate,
  retrievalState,
} from '../../lib/documentModel.ts';
import { retrieveRagKnowledge } from '../../services/rag.ts';
import type { RetrievalChunkVO, RetrievalVO } from '../../services/types.ts';

const KNOWLEDGE_BASE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_QUERY = 4000;

/** 渲染后同步到 ref 的最新值：异步回调里读，不必重建。 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/**
 * 检索测试（照 1.2.4 的 RetrievalDrawer）：每次提交调用一次检索服务；服务停用、暂不可用都不当成“没有命中”；
 * 改了输入就作废进行中的请求，身份变了的迟到结果不显示。
 */
export function RetrievalSheet({
  knowledgeBase,
  identityScope,
  onClose,
  onSource,
}: {
  knowledgeBase?: string;
  identityScope: string;
  onClose: () => void;
  onSource: (chunk: RetrievalChunkVO) => void;
}) {
  const { t } = useTranslation('rag');
  const ids = { kb: useId(), query: useId(), topK: useId() };
  const [result, setResult] = useState<RetrievalVO>();
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const gate = useRef(createDocumentRequestGate());
  const liveScope = useLatest(identityScope);
  useEffect(() => {
    const current = gate.current;
    return () => current.cancel();
  }, []);

  const schema = useMemo(
    () =>
      z.object({
        knowledgeBase: z
          .string()
          .trim()
          .refine(
            (value) => !value || KNOWLEDGE_BASE.test(value),
            t('retrieval.knowledgeBaseRule'),
          ),
        query: z
          .string()
          .trim()
          .min(1, t('retrieval.queryRule'))
          .max(MAX_QUERY),
        topK: z
          .number({ error: t('retrieval.topKRule') })
          .int(t('retrieval.topKRule'))
          .min(1, t('retrieval.topKRule'))
          .max(20, t('retrieval.topKRule')),
      }),
    [t],
  );
  type Values = z.input<typeof schema>;
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { knowledgeBase: knowledgeBase ?? '', query: '', topK: 6 },
  });
  const query = useWatch({ control: form.control, name: 'query' });

  // 改了输入：作废进行中的请求，清掉旧结果（照 1.2.4 的 onValuesChange）。
  const invalidate = () => {
    gate.current.cancel();
    setResult(undefined);
    setFailed(false);
    setSearching(false);
  };

  const search = async (values: z.output<typeof schema>) => {
    const request = gate.current.begin(identityScope);
    setSearching(true);
    setFailed(false);
    setResult(undefined);
    try {
      const response = await retrieveRagKnowledge(
        {
          query: values.query,
          collectionName: values.knowledgeBase || undefined,
          topK: values.topK,
        },
        request.signal,
      );
      if (!response) throw new Error('Missing retrieval result');
      if (request.isCurrent(liveScope.current)) setResult(response);
    } catch {
      if (request.isCurrent(liveScope.current)) setFailed(true);
    } finally {
      if (request.isCurrent(liveScope.current)) setSearching(false);
    }
  };

  const state = retrievalState(result);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="rag:overflow-y-auto rag:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t('retrieval.title')}</SheetTitle>
          <SheetDescription>{t('retrieval.description')}</SheetDescription>
        </SheetHeader>
        <div className="rag:flex rag:flex-col rag:gap-4 rag:px-4 rag:pb-6">
          <form
            noValidate
            onSubmit={(event) => void form.handleSubmit(search)(event)}
            className="rag:flex rag:flex-col rag:gap-4"
          >
            <Controller
              control={form.control}
              name="knowledgeBase"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={ids.kb}>
                    {t('retrieval.knowledgeBase')}
                  </FieldLabel>
                  <Input
                    id={ids.kb}
                    maxLength={64}
                    placeholder={t('retrieval.knowledgeBasePlaceholder')}
                    aria-invalid={fieldState.invalid}
                    {...field}
                    onChange={(event) => {
                      invalidate();
                      field.onChange(event);
                    }}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="query"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={ids.query}>
                    {t('retrieval.query')}
                  </FieldLabel>
                  <Textarea
                    id={ids.query}
                    rows={3}
                    maxLength={MAX_QUERY}
                    placeholder={t('retrieval.queryPlaceholder')}
                    aria-invalid={fieldState.invalid}
                    {...field}
                    onChange={(event) => {
                      invalidate();
                      field.onChange(event);
                    }}
                  />
                  <FieldDescription className="rag:text-right">
                    {t('retrieval.queryCount', {
                      count: query?.length ?? 0,
                      max: MAX_QUERY,
                    })}
                  </FieldDescription>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
            <div className="rag:flex rag:flex-wrap rag:items-end rag:gap-3">
              <Controller
                control={form.control}
                name="topK"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="rag:w-40">
                    <FieldLabel htmlFor={ids.topK}>
                      {t('retrieval.topK')}
                    </FieldLabel>
                    <Input
                      id={ids.topK}
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      aria-invalid={fieldState.invalid}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={Number.isFinite(field.value) ? field.value : ''}
                      onChange={(event) => {
                        invalidate();
                        field.onChange(
                          event.target.value === ''
                            ? Number.NaN
                            : Number(event.target.value),
                        );
                      }}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
              <Button type="submit" disabled={searching} aria-busy={searching}>
                <Search aria-hidden="true" />
                {t('retrieval.submit')}
              </Button>
            </div>
            <p className="rag:text-sm rag:text-muted-foreground">
              {t('retrieval.costNote')}
            </p>
          </form>
          {failed ? (
            <Notice tone="error" title={t('retrieval.failed')} />
          ) : null}
          {state === 'disabled' ? (
            <Notice tone="warning" title={t('retrieval.disabled')} />
          ) : null}
          {state === 'unavailable' ? (
            <Notice tone="error" title={t('retrieval.unavailable')} />
          ) : null}
          {state === 'empty' ? (
            <EmptyState title={t('retrieval.empty')} />
          ) : null}
          {state === 'idle' && !failed && !searching ? (
            <EmptyState title={t('retrieval.idle')} />
          ) : null}
          {state === 'matched' && result ? (
            <section
              aria-label={t('retrieval.results')}
              className="rag:flex rag:flex-col rag:gap-2"
            >
              <div className="rag:flex rag:flex-wrap rag:items-baseline rag:justify-between rag:gap-2">
                <h3 className="rag:font-semibold">{t('retrieval.matched')}</h3>
                <span className="rag:text-sm rag:text-muted-foreground">
                  {t('retrieval.matchedCount', {
                    chunks: result.chunks.length,
                    documents: result.sourceCount,
                  })}
                </span>
              </div>
              <ol className="rag:flex rag:flex-col rag:divide-y rag:rounded-md rag:border">
                {result.chunks.map((chunk, index) => (
                  <li
                    key={chunk.chunkId}
                    className="rag:flex rag:gap-3 rag:p-3"
                  >
                    <span
                      aria-hidden="true"
                      className="rag:flex rag:size-6 rag:shrink-0 rag:items-center rag:justify-center rag:rounded-full rag:bg-muted rag:text-xs"
                    >
                      {index + 1}
                    </span>
                    <div className="rag:flex rag:min-w-0 rag:flex-1 rag:flex-col rag:gap-1">
                      <span className="rag:flex rag:flex-wrap rag:items-center rag:gap-2">
                        <Button
                          variant="link"
                          className="rag:h-auto rag:p-0 rag:break-all rag:whitespace-normal"
                          onClick={() => onSource(chunk)}
                        >
                          {chunk.title || t('documentFallback')}
                        </Button>
                        <Badge variant="secondary">
                          {Number.isFinite(chunk.score)
                            ? chunk.score.toFixed(4)
                            : t('retrieval.scoreMissing')}
                        </Badge>
                      </span>
                      <span className="rag:text-xs rag:text-muted-foreground rag:break-all">
                        {chunk.source}
                      </span>
                      <p className="rag:line-clamp-3 rag:text-sm rag:whitespace-pre-wrap rag:break-words">
                        {chunk.content}
                      </p>
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSource(chunk)}
                        >
                          {t('retrieval.viewSource')}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
