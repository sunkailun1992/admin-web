import { useState, type MouseEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/alert-dialog.tsx';

export type ConfirmActionProps = {
  title: string;
  description?: string;
  confirmText: string;
  /** 失败时由调用方（请求层）提示错误；这里只保持弹窗打开，便于重试或取消。 */
  onConfirm: () => Promise<void>;
  children: ReactElement;
};

/** 需要二次确认的操作（如删除）：确认后才调用 onConfirm，进行中按钮禁用，成功后关闭。 */
export function ConfirmAction({
  title,
  description,
  confirmText,
  onConfirm,
  children,
}: ConfirmActionProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const confirm = async (event: MouseEvent) => {
    // 等操作完成再关。
    event.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // 错误已由请求层提示（与 TanStack Query 的 mutate 一样不再向外抛）。
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t('confirmDelete.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t('actions.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={confirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
