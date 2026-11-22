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
} from '@admin-web/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useEffectEvent, useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Notice } from '../../components/Notice.tsx';
import { Section } from '../../components/Section.tsx';
import type {
  StorageCapabilitiesVO,
  StorageLimit,
  StorageSettingsVO,
} from '../../services/types.ts';
import {
  formatStorageSize,
  type StorageDefaultPlatform,
} from './storageModel.ts';

export type StorageSettingsValues = {
  defaultPlatform: string;
  uploadTtlSeconds: number;
  viewTtlSeconds: number;
  maxUploadBytes: number;
};

type Limits = StorageCapabilitiesVO['limits'];
type NumberName = keyof Limits;

const valuesOf = (settings: StorageSettingsVO) => ({
  defaultPlatform: settings.defaultPlatform ?? '',
  uploadTtlSeconds: settings.uploadTtlSeconds,
  viewTtlSeconds: settings.viewTtlSeconds,
  maxUploadBytes: settings.maxUploadBytes,
});

function NumberField({
  control,
  name,
  label,
  limit,
  description,
  disabled,
}: {
  control: Control<StorageSettingsValues>;
  name: NumberName;
  label: string;
  limit: StorageLimit;
  description?: string;
  disabled: boolean;
}) {
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
            type="number"
            inputMode="numeric"
            min={limit.min}
            max={limit.max}
            step={1}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={Number.isFinite(field.value) ? field.value : ''}
            onChange={(event) =>
              field.onChange(
                event.target.value === ''
                  ? Number.NaN
                  : Number(event.target.value),
              )
            }
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
 * 默认存储与私有访问策略（照 1.2.4 的 StorageSettingsPanel）：默认平台只能选已生效、允许新上传的；
 * 秒数与字节数按服务端上下限；保存前二次确认，带策略版本核对。
 */
export function StorageSettingsPanel({
  settings,
  capabilities,
  defaultPlatforms,
  disabled,
  onSubmit,
}: {
  settings: StorageSettingsVO;
  capabilities: StorageCapabilitiesVO;
  defaultPlatforms: StorageDefaultPlatform[];
  disabled: boolean;
  /** 返回 false 表示没发出请求（校验没过或当前不能提交），确认框保持打开。 */
  onSubmit: (values: StorageSettingsValues) => boolean;
}) {
  const { t, i18n } = useTranslation('ai');
  const { t: tc } = useTranslation('common');
  const platformId = useId();
  const limits = capabilities.limits;
  const schema = useMemo(() => {
    const integer = (limit: StorageLimit) => {
      const message = t('storage.settings.range', limit);
      return z
        .number({ error: message })
        .int(message)
        .min(limit.min, message)
        .max(limit.max, message);
    };
    return z.object({
      defaultPlatform: z.string(),
      uploadTtlSeconds: integer(limits.uploadTtlSeconds),
      viewTtlSeconds: integer(limits.viewTtlSeconds),
      maxUploadBytes: integer(limits.maxUploadBytes),
    });
  }, [t, limits]);
  const form = useForm<StorageSettingsValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesOf(settings),
  });
  const [confirmation, setConfirmation] = useState<StorageSettingsValues>();

  // 服务端设置换了版本：清掉待确认的提交（渲染期按前值调整），表单值经 effect 重置；
  // 同一版本的设置重新传进来，不重置正在改的内容。
  const [shownVersion, setShownVersion] = useState(settings.version);
  if (shownVersion !== settings.version) {
    setShownVersion(settings.version);
    setConfirmation(undefined);
  }
  const { reset } = form;
  // 只在版本变化时重置（每次读取 settings 都是新对象）；重置用最新一次渲染的值。
  const fill = useEffectEvent(() => reset(valuesOf(settings)));
  useEffect(() => {
    fill();
  }, [settings.version]);

  const maxUploadBytes = useWatch({
    control: form.control,
    name: 'maxUploadBytes',
  });
  const dirty = form.formState.isDirty;
  const options = defaultPlatforms.map((entry) => ({
    value: entry.platform,
    label: t('storage.settings.option', entry),
    disabled: false,
  }));
  if (
    settings.defaultPlatform &&
    !options.some((entry) => entry.value === settings.defaultPlatform)
  )
    options.unshift({
      value: settings.defaultPlatform,
      label: t('storage.settings.currentUnavailable', {
        platform: settings.defaultPlatform,
      }),
      disabled: true,
    });
  const size = (value: unknown) => formatStorageSize(value, t, i18n.language);

  return (
    <Section title={t('storage.settings.title')}>
      <DescriptionList
        items={[
          {
            label: t('storage.settings.defaultPlatform'),
            value: (
              <span className="break-all">
                {settings.defaultPlatform ||
                  t('storage.settings.defaultPlatformMissing')}
              </span>
            ),
          },
          { label: t('storage.settings.version'), value: settings.version },
          {
            label: t('storage.settings.legacy'),
            value: (
              <span className="break-all">
                {settings.legacyNullPlatform ||
                  t('storage.settings.notConfigured')}
              </span>
            ),
          },
          {
            label: t('storage.settings.baseDir'),
            value: (
              <span className="break-all">
                {settings.baseDir || t('storage.settings.notSet')}
              </span>
            ),
          },
        ]}
      />
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => {
          if (!disabled) setConfirmation(values);
        })}
      >
        <Controller
          control={form.control}
          name="defaultPlatform"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={platformId}>
                {t('storage.settings.defaultField')}
              </FieldLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={disabled}
              >
                <SelectTrigger id={platformId} className="w-full">
                  <SelectValue
                    placeholder={t('storage.settings.defaultPlaceholder')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {t('storage.settings.defaultHint')}
              </FieldDescription>
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            control={form.control}
            name="uploadTtlSeconds"
            label={t('storage.settings.uploadTtl')}
            limit={limits.uploadTtlSeconds}
            disabled={disabled}
          />
          <NumberField
            control={form.control}
            name="viewTtlSeconds"
            label={t('storage.settings.viewTtl')}
            limit={limits.viewTtlSeconds}
            disabled={disabled}
          />
        </div>
        <NumberField
          control={form.control}
          name="maxUploadBytes"
          label={t('storage.settings.maxUpload')}
          limit={limits.maxUploadBytes}
          disabled={disabled}
          description={t('storage.settings.maxUploadHint', {
            current: size(
              Number.isFinite(maxUploadBytes)
                ? maxUploadBytes
                : settings.maxUploadBytes,
            ),
            max: size(limits.maxUploadBytes.max),
          })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={disabled || !dirty}>
            {t('storage.settings.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !dirty}
            onClick={() => reset(valuesOf(settings))}
          >
            {t('storage.settings.reset')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('storage.settings.privateNote')}
          </span>
        </div>
      </form>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('storage.settings.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('storage.settings.confirmWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Notice
            tone="warning"
            title={t('storage.settings.confirmWarningTitle')}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={disabled}
              onClick={(event) => {
                if (disabled || !confirmation) return;
                // 没发出请求就保持打开。
                if (!onSubmit(confirmation)) event.preventDefault();
                else setConfirmation(undefined);
              }}
            >
              {t('storage.settings.confirmOk')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
