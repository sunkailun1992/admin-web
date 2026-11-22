import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/button.tsx';
import { Input } from '../components/input.tsx';

export type GeneratedCodeInputProps = {
  value?: string;
  onChange: (value: string) => void;
  /**
   * 向后端要一个新编码（业务编码只由后端生成）。不传就没有“生成”按钮（编辑时）。
   * 失败时由调用方（请求层）提示错误。
   */
  generate?: () => Promise<string>;
  disabled?: boolean;
} & Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'disabled'>;

/** 编码输入框，右侧“生成”按钮调后端生成编码；生成中按钮禁用。 */
export function GeneratedCodeInput({
  value,
  onChange,
  generate,
  disabled,
  ...inputProps
}: GeneratedCodeInputProps) {
  const { t } = useTranslation('common');
  const [generating, setGenerating] = useState(false);

  const run = async () => {
    if (!generate) return;
    setGenerating(true);
    try {
      onChange(await generate());
    } catch {
      // 错误已由请求层提示；输入框保持原值。
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex">
      <Input
        {...inputProps}
        className="rounded-r-none"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {generate ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-l-none border-l-0"
          disabled={disabled || generating}
          onClick={run}
        >
          {t('actions.generate')}
        </Button>
      ) : null}
    </div>
  );
}
