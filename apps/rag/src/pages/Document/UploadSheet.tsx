import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DescriptionList,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  UploadDropzone,
} from '@admin-web/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, FileText, Upload } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Notice } from '../../components/Notice.tsx';
import { createDocumentRequestGate } from '../../lib/documentModel.ts';
import { uploadGraphNotice } from '../../lib/graphModel.ts';
import {
  RAG_UPLOAD_ACCEPT,
  validateRagUpload,
} from '../../lib/uploadValidation.ts';
import { uploadRagDocument } from '../../services/rag.ts';
import type { DocumentIngestionVO } from '../../services/types.ts';

const CODE = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_KNOWLEDGE_BASE = 'general-knowledge';

type UploadValues = {
  knowledgeBase: string;
  title: string;
  documentCode: string;
};

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function TextInput({
  control,
  name,
  label,
  description,
  disabled,
  ...input
}: {
  control: Control<UploadValues>;
  name: keyof UploadValues;
  label: string;
  description?: string;
  disabled: boolean;
} & Omit<ComponentProps<'input'>, 'name' | 'value' | 'onChange' | 'disabled'>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            aria-invalid={fieldState.invalid}
            disabled={disabled}
            {...input}
            {...field}
          />
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

/**
 * 上传知识文档（照 1.2.4 的 UploadDocumentDrawer）：上传前做前置校验；结果按“已写入且校验通过”才算成功，
 * 结果不明时提示先刷新列表核对；图谱构建单独提示，不影响已通过的向量上传。上传中不能关闭。
 */
export function UploadSheet({
  knowledgeBase,
  identityScope,
  onClose,
  onUploaded,
}: {
  knowledgeBase?: string;
  identityScope: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t } = useTranslation('rag');
  const { t: tc } = useTranslation('common');
  const formId = useId();
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<DocumentIngestionVO>();
  const [failed, setFailed] = useState(false);
  const gate = useRef(createDocumentRequestGate());
  const liveScope = useLatest(identityScope);
  useEffect(() => {
    const current = gate.current;
    return () => current.cancel();
  }, []);

  const schema = useMemo(() => {
    const code = (message: string) =>
      z
        .string()
        .trim()
        .refine((value) => !value || CODE.test(value), message);
    return z.object({
      knowledgeBase: z
        .string()
        .trim()
        .min(1, t('upload.knowledgeBaseRequired'))
        .refine((value) => CODE.test(value), t('upload.codeRule')),
      title: z.string().trim().max(120),
      documentCode: code(t('upload.codeRule')),
    });
  }, [t]);
  const form = useForm<UploadValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      knowledgeBase: knowledgeBase || DEFAULT_KNOWLEDGE_BASE,
      title: '',
      documentCode: '',
    },
  });

  const upload = async (values: UploadValues) => {
    if (!file) {
      setFileError(t('upload.fileRequired'));
      return;
    }
    const invalid = validateRagUpload(file);
    if (invalid) {
      setFileError(t(`upload.errors.${invalid}`));
      return;
    }
    const request = gate.current.begin(identityScope);
    const body = new FormData();
    body.append('file', file);
    body.append('knowledgeBase', values.knowledgeBase);
    if (values.documentCode) body.append('documentCode', values.documentCode);
    if (values.title) body.append('title', values.title);
    setUploading(true);
    setFailed(false);
    try {
      const response = await uploadRagDocument(body, request.signal);
      if (!request.isCurrent(liveScope.current)) return;
      if (!response?.document?.documentId || !response.validation?.valid)
        throw new Error('Upload result is not validated');
      setResult(response);
      onUploaded();
    } catch {
      if (request.isCurrent(liveScope.current)) setFailed(true);
    } finally {
      if (request.isCurrent(liveScope.current)) setUploading(false);
    }
  };

  const notice = result ? uploadGraphNotice(result) : undefined;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !uploading) onClose();
      }}
    >
      <SheetContent
        className="rag:overflow-y-auto rag:sm:max-w-xl"
        showCloseButton={!uploading}
        onEscapeKeyDown={(event) => {
          if (uploading) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (uploading) event.preventDefault();
        }}
      >
        <SheetHeader>
          <SheetTitle>{t('upload.title')}</SheetTitle>
          <SheetDescription>{t('upload.description')}</SheetDescription>
        </SheetHeader>
        <div className="rag:flex rag:flex-col rag:gap-4 rag:px-4">
          {result ? (
            <>
              <Notice
                tone="success"
                title={
                  result.idempotent ? t('upload.reused') : t('upload.succeeded')
                }
              />
              <DescriptionList
                items={[
                  {
                    label: t('upload.document'),
                    value: (
                      <span className="rag:break-all">
                        {result.document.title}
                      </span>
                    ),
                  },
                  {
                    label: t('upload.knowledgeBase'),
                    value: result.document.knowledgeBase,
                  },
                  {
                    label: t('upload.version'),
                    value: t('upload.versionValue', {
                      version: result.document.documentVersion,
                    }),
                  },
                  {
                    label: t('upload.validChunks'),
                    value: result.validation.validPointCount,
                  },
                ]}
              />
              {notice ? (
                <Notice tone={notice.type} title={t(`upload.${notice.key}`)} />
              ) : null}
            </>
          ) : (
            <form
              id={formId}
              noValidate
              onSubmit={(event) => void form.handleSubmit(upload)(event)}
              className="rag:flex rag:flex-col rag:gap-4"
            >
              <Field data-invalid={!!fileError}>
                <span className="rag:text-sm rag:font-medium">
                  {t('upload.file')}
                </span>
                <UploadDropzone
                  label={t('upload.dropzone')}
                  accept={RAG_UPLOAD_ACCEPT}
                  hint={t('upload.formats')}
                  disabled={uploading}
                  validate={(candidate) => {
                    const invalid = validateRagUpload(candidate);
                    return invalid ? t(`upload.errors.${invalid}`) : undefined;
                  }}
                  onFiles={(files) => {
                    setFile(files[0]);
                    setFileError(undefined);
                  }}
                />
                {file ? (
                  <span className="rag:flex rag:items-center rag:gap-2 rag:text-sm">
                    <FileText aria-hidden="true" className="rag:size-4" />
                    <span className="rag:break-all">{file.name}</span>
                    <Badge variant="secondary">{t('upload.selected')}</Badge>
                  </span>
                ) : null}
                {fileError ? <FieldError>{fileError}</FieldError> : null}
              </Field>
              <TextInput
                control={form.control}
                name="knowledgeBase"
                label={t('upload.knowledgeBase')}
                maxLength={64}
                disabled={uploading}
              />
              <TextInput
                control={form.control}
                name="title"
                label={t('upload.titleField')}
                placeholder={t('upload.titlePlaceholder')}
                maxLength={120}
                disabled={uploading}
              />
              <TextInput
                control={form.control}
                name="documentCode"
                label={t('upload.documentCode')}
                placeholder={t('upload.documentCodePlaceholder')}
                description={t('upload.documentCodeHint')}
                maxLength={64}
                disabled={uploading}
              />
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rag:group rag:-ml-2"
                  >
                    {t('upload.helpTitle')}
                    <ChevronDown
                      aria-hidden="true"
                      className="rag:transition-transform rag:group-data-[state=open]:rotate-180"
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="rag:pt-1 rag:text-sm rag:text-muted-foreground">
                  {t('upload.help')}
                </CollapsibleContent>
              </Collapsible>
              {uploading ? (
                <Notice tone="info" title={t('upload.uploading')} />
              ) : null}
              {failed ? (
                <Notice
                  tone="error"
                  title={t('upload.unconfirmed')}
                  description={t('upload.unconfirmedDescription')}
                />
              ) : null}
            </form>
          )}
        </div>
        <SheetFooter className="rag:flex-row rag:justify-end">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            {result ? t('upload.done') : tc('actions.close')}
          </Button>
          {result ? (
            <Button
              onClick={() => {
                setResult(undefined);
                setFile(undefined);
                form.setValue('title', '');
                form.setValue('documentCode', '');
              }}
            >
              {t('upload.continue')}
            </Button>
          ) : (
            <Button
              type="submit"
              form={formId}
              disabled={uploading}
              aria-busy={uploading}
            >
              <Upload aria-hidden="true" />
              {t('upload.submit')}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
