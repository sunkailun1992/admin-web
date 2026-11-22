import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { Alert, AlertDescription } from '../components/alert.tsx';
import { Button } from '../components/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/dialog.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../components/sheet.tsx';

type Schema = z.ZodType<FieldValues, FieldValues>;

export type FormDialogProps<S extends Schema> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  schema: S;
  defaultValues: DefaultValues<z.input<S>>;
  /** 抛错时弹窗保持打开，并在表单下方显示错误信息。 */
  onSubmit: (values: z.output<S>) => Promise<void>;
  children: (
    form: UseFormReturn<z.input<S>, unknown, z.output<S>>,
  ) => ReactNode;
  submitText?: string;
  /** 字段多时用侧边抽屉。 */
  variant?: 'dialog' | 'sheet';
};

/**
 * 表单弹窗或抽屉：react-hook-form 管表单，zod 校验；提交中禁用按钮，成功后关闭。
 * 表单状态放在弹层内容里，关闭时随内容卸载，每次打开都是新的。
 */
export function FormDialog<S extends Schema>(props: FormDialogProps<S>) {
  const { open, onOpenChange, title, description, variant = 'dialog' } = props;
  // 没有说明时按 Radix 的约定显式去掉 aria-describedby。
  const describedBy = description ? {} : { 'aria-describedby': undefined };
  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent {...describedBy} className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </SheetHeader>
          <FormBody {...props} />
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...describedBy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <FormBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function FormBody<S extends Schema>({
  onOpenChange,
  schema,
  defaultValues,
  onSubmit,
  children,
  submitText,
  variant = 'dialog',
}: FormDialogProps<S>) {
  const { t } = useTranslation('common');
  const [error, setError] = useState<string>();
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const pending = form.formState.isSubmitting;
  const sheet = variant === 'sheet';
  const Footer = sheet ? SheetFooter : DialogFooter;

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  });

  return (
    <form
      noValidate
      onSubmit={submit}
      className={sheet ? 'flex min-h-0 flex-1 flex-col' : 'grid gap-4'}
    >
      <div
        className={
          sheet
            ? 'grid flex-1 content-start gap-4 overflow-y-auto px-4'
            : 'grid gap-4'
        }
      >
        {children(form)}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <Footer>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {submitText ?? t('actions.save')}
        </Button>
      </Footer>
    </form>
  );
}
