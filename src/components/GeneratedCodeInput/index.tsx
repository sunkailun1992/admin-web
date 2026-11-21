import { Button, Input, Space } from 'antd';

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** 正在请求后端生成编码。 */
  generating?: boolean;
  /** 新建时传入：业务编码由后端生成接口给出（AGENTS 约定），不在浏览器里编。编辑时不传，就没有“生成”按钮。 */
  onGenerate?: () => void;
};

/**
 * 业务编码输入框：输入框与“生成”按钮用 Space.Compact 组合（antd 起已弃用输入框的 addonAfter）。
 * 作为表单项的受控组件使用，value / onChange 由 Form.Item 注入。
 */
export default function GeneratedCodeInput({
  value,
  onChange,
  disabled,
  generating,
  onGenerate,
}: Props) {
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        disabled={disabled}
        placeholder="请输入"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {onGenerate && (
        <Button loading={generating} onClick={onGenerate}>
          生成
        </Button>
      )}
    </Space.Compact>
  );
}
