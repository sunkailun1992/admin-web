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
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from '@admin-web/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo, useState, type ComponentProps } from 'react';
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Notice } from '../../components/Notice.tsx';
import type {
  StorageCapabilitiesVO,
  StorageConfigurationVO,
  StorageProvider,
} from '../../services/types.ts';
import {
  hasStorageConfigurationChanges,
  STORAGE_PROVIDERS,
} from './storageModel.ts';

export type StorageFormValues = {
  name: string;
  provider: StorageProvider | '';
  endpoint: string;
  bucket: string;
  region: string;
  uploadEnabled: boolean;
  credentialAction: 'KEEP' | 'REPLACE';
  accessKeyId: string;
  secretKey: string;
};

type TextName = Extract<
  FieldPath<StorageFormValues>,
  'name' | 'endpoint' | 'bucket' | 'region' | 'accessKeyId' | 'secretKey'
>;

function TextInput({
  control,
  name,
  label,
  description,
  ...input
}: {
  control: Control<StorageFormValues>;
  name: TextName;
  label: string;
  description?: string;
} & Omit<ComponentProps<'input'>, 'name' | 'value' | 'onChange'>) {
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
 * 新增或编辑文件存储配置（照 1.2.4 的 StorageConfigurationDrawer）：对象位置建好后不能改；
 * 凭据只单向提交，不回显旧密钥；编辑没有实际改动时不能保存；保存前二次确认。
 */
export function StorageConfigurationSheet({
  current,
  capabilities,
  disabled,
  onClose,
  onSubmit,
}: {
  current?: StorageConfigurationVO;
  capabilities: StorageCapabilitiesVO;
  disabled: boolean;
  onClose: () => void;
  /** 返回 false 表示没发出请求（校验没过或当前不能提交），确认框保持打开。 */
  onSubmit: (values: StorageFormValues) => boolean;
}) {
  const { t } = useTranslation('ai');
  const { t: tc } = useTranslation('common');
  const formId = useId();
  const providerId = useId();
  const uploadId = useId();
  const credentialId = useId();
  const providerOf = (code: string | undefined) =>
    capabilities.providers.find((entry) => entry.code === code);

  const schema = useMemo(
    () =>
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1, t('storage.editor.nameRule'))
            .max(120, t('storage.editor.nameRule')),
          provider: z.enum(['', ...STORAGE_PROVIDERS]),
          endpoint: z.string().trim(),
          bucket: z.string().trim().max(255, t('storage.editor.bucketRule')),
          region: z.string().trim().max(128),
          uploadEnabled: z.boolean(),
          credentialAction: z.enum(['KEEP', 'REPLACE']),
          accessKeyId: z.string().max(4096),
          secretKey: z.string().max(4096),
        })
        .superRefine((values, context) => {
          const required = (path: keyof StorageFormValues, message: string) =>
            context.addIssue({ code: 'custom', path: [path], message });
          if (!current) {
            const provider = capabilities.providers.find(
              (entry) => entry.code === values.provider,
            );
            if (!provider || provider.availability !== 'AVAILABLE')
              required('provider', t('storage.editor.providerRule'));
            if (provider?.endpointRequired && !values.endpoint)
              required('endpoint', t('storage.editor.endpointRule'));
            if (!values.bucket)
              required('bucket', t('storage.editor.bucketRule'));
            if (provider?.regionRequired && !values.region)
              required('region', t('storage.editor.regionRule'));
          }
          if (!current || values.credentialAction === 'REPLACE') {
            if (!values.accessKeyId.trim())
              required('accessKeyId', t('storage.editor.accessKeyRule'));
            if (!values.secretKey.trim())
              required('secretKey', t('storage.editor.secretKeyRule'));
          }
        }),
    [t, current, capabilities],
  );

  const form = useForm<StorageFormValues>({
    resolver: zodResolver(schema),
    defaultValues: current
      ? {
          name: current.name,
          provider: current.provider,
          endpoint: '',
          bucket: '',
          region: '',
          uploadEnabled: current.uploadEnabled,
          credentialAction: 'KEEP',
          accessKeyId: '',
          secretKey: '',
        }
      : {
          name: '',
          provider:
            capabilities.providers.find(
              (entry) => entry.availability === 'AVAILABLE',
            )?.code ?? '',
          endpoint: '',
          bucket: '',
          region: '',
          uploadEnabled: true,
          credentialAction: 'REPLACE',
          accessKeyId: '',
          secretKey: '',
        },
  });
  const values = useWatch({ control: form.control });
  const provider = providerOf(current?.provider ?? values.provider);
  const changed = !current || hasStorageConfigurationChanges(values, current);
  const replacing = !current || values.credentialAction === 'REPLACE';
  const [confirmed, setConfirmed] = useState<StorageFormValues>();

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent className="ai:overflow-y-auto ai:sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {current
                ? t('storage.editor.editTitle')
                : t('storage.editor.createTitle')}
            </SheetTitle>
            <SheetDescription>
              {t('storage.editor.introDescription')}
            </SheetDescription>
          </SheetHeader>
          <div className="ai:flex ai:flex-col ai:gap-4 ai:px-4">
            <Notice tone="info" title={t('storage.editor.introTitle')} />
            {current ? (
              <DescriptionList
                items={[
                  {
                    label: t('storage.editor.platform'),
                    value: (
                      <span className="ai:break-all">{current.platform}</span>
                    ),
                  },
                  {
                    label: t('storage.editor.provider'),
                    value: provider?.label || current.provider,
                  },
                  {
                    label: t('storage.editor.endpoint'),
                    value: (
                      <span className="ai:break-all">{current.endpoint}</span>
                    ),
                  },
                  {
                    label: t('storage.editor.bucketRegion'),
                    value: (
                      <span className="ai:break-all">
                        {current.bucket}
                        {current.region ? ` / ${current.region}` : ''}
                      </span>
                    ),
                  },
                  {
                    label: t('storage.editor.references'),
                    value: t('storage.editor.referencesValue', {
                      count: current.referenceCount,
                    }),
                  },
                ]}
              />
            ) : null}
            <form
              id={formId}
              noValidate
              autoComplete="off"
              className="ai:flex ai:flex-col ai:gap-4"
              onSubmit={form.handleSubmit((submitted) => {
                if (
                  disabled ||
                  (current &&
                    !hasStorageConfigurationChanges(submitted, current))
                )
                  return;
                setConfirmed(submitted);
              })}
            >
              <TextInput
                control={form.control}
                name="name"
                label={t('storage.editor.name')}
                maxLength={120}
                disabled={disabled}
              />
              {!current ? (
                <>
                  <Controller
                    control={form.control}
                    name="provider"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={providerId}>
                          {t('storage.editor.providerType')}
                        </FieldLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={disabled}
                        >
                          <SelectTrigger
                            id={providerId}
                            aria-invalid={fieldState.invalid}
                            className="ai:w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {capabilities.providers.map((entry) => (
                              <SelectItem
                                key={entry.code}
                                value={entry.code}
                                disabled={entry.availability !== 'AVAILABLE'}
                              >
                                {entry.availability === 'AVAILABLE'
                                  ? entry.label
                                  : t('storage.editor.providerUnavailable', {
                                      label: entry.label,
                                    })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                  {provider?.endpointRequired ? (
                    <TextInput
                      control={form.control}
                      name="endpoint"
                      label={t('storage.editor.endpointLabel')}
                      description={t('storage.editor.endpointHint')}
                      placeholder="https://storage.example.invalid"
                      maxLength={2048}
                      disabled={disabled}
                    />
                  ) : null}
                  <TextInput
                    control={form.control}
                    name="bucket"
                    label={t('storage.editor.bucket')}
                    maxLength={255}
                    disabled={disabled}
                  />
                  <TextInput
                    control={form.control}
                    name="region"
                    label={t('storage.editor.region')}
                    description={
                      provider?.code === 'TENCENT_COS'
                        ? t('storage.editor.regionHintCos')
                        : t('storage.editor.regionHint')
                    }
                    maxLength={128}
                    disabled={disabled}
                  />
                </>
              ) : null}
              <Controller
                control={form.control}
                name="uploadEnabled"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Switch
                      id={uploadId}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                    />
                    <div className="ai:flex ai:flex-col ai:gap-1">
                      <FieldLabel htmlFor={uploadId}>
                        {t('storage.editor.uploadEnabled')}
                      </FieldLabel>
                      <FieldDescription>
                        {t('storage.editor.uploadHint')}
                      </FieldDescription>
                    </div>
                  </Field>
                )}
              />
              {current ? (
                <Controller
                  control={form.control}
                  name="credentialAction"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor={credentialId}>
                        {t('storage.editor.credentialAction')}
                      </FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={(next) => {
                          field.onChange(next);
                          // 改回保留时清掉已输入的新凭据，不留在表单里。
                          if (next === 'KEEP') {
                            form.setValue('accessKeyId', '');
                            form.setValue('secretKey', '');
                          }
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger id={credentialId} className="ai:w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KEEP">
                            {t('storage.editor.keep')}
                          </SelectItem>
                          <SelectItem value="REPLACE">
                            {t('storage.editor.replace')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              ) : null}
              {replacing ? (
                <>
                  <TextInput
                    control={form.control}
                    name="accessKeyId"
                    label={t('storage.editor.accessKeyId')}
                    type="password"
                    autoComplete="new-password"
                    maxLength={4096}
                    disabled={disabled}
                  />
                  <TextInput
                    control={form.control}
                    name="secretKey"
                    label={t('storage.editor.secretKey')}
                    type="password"
                    autoComplete="new-password"
                    maxLength={4096}
                    disabled={disabled}
                  />
                </>
              ) : (
                <p className="ai:text-sm ai:text-muted-foreground">
                  {t('storage.editor.credentialsHidden')}
                </p>
              )}
            </form>
          </div>
          <SheetFooter className="ai:flex-row ai:justify-end">
            <Button variant="outline" onClick={onClose}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form={formId} disabled={disabled || !changed}>
              {t('storage.editor.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!confirmed}
        onOpenChange={(open) => {
          if (!open) setConfirmed(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {current
                ? t('storage.editor.confirmEdit')
                : t('storage.editor.confirmCreate')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('storage.editor.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmed?.credentialAction === 'REPLACE' ? (
            <Notice
              tone="warning"
              title={t('storage.editor.confirmCredentials')}
            />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('storage.editor.confirmBack')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={disabled || !changed}
              onClick={(event) => {
                if (
                  !confirmed ||
                  disabled ||
                  (current &&
                    !hasStorageConfigurationChanges(confirmed, current)) ||
                  !onSubmit(confirmed)
                ) {
                  event.preventDefault();
                  return;
                }
                setConfirmed(undefined);
              }}
            >
              {t('storage.editor.confirmOk')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
