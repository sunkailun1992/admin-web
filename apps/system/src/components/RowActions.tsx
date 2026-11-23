import { Button, ConfirmAction } from '@admin-web/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** 行操作：编辑、其它操作、删除（删除要先确认）。 */
export function RowActions({
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
  children,
}: {
  onEdit: () => void;
  onDelete: () => Promise<void>;
  deleteTitle: string;
  deleteDescription: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation('common');
  return (
    <div className="system:flex system:flex-wrap system:gap-1">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="system:h-auto system:px-1"
        onClick={onEdit}
      >
        {t('actions.edit')}
      </Button>
      {children}
      <ConfirmAction
        title={deleteTitle}
        description={deleteDescription}
        confirmText={t('actions.delete')}
        onConfirm={onDelete}
      >
        <Button
          type="button"
          variant="link"
          size="sm"
          className="system:h-auto system:px-1 system:text-destructive"
        >
          {t('actions.delete')}
        </Button>
      </ConfirmAction>
    </div>
  );
}

/** 其它行操作按钮（绑定角色、绑定资源、数据范围）。 */
export function RowAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="system:h-auto system:px-1"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
