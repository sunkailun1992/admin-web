import PageContainer from '@/components/AppPageContainer';
import {
  getAiModelSelection,
  updateAiModelSelection,
} from '@/services/ai';
import {
  ProForm,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Button, Descriptions, Space, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Gemini',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
};

export default function AiModelPage() {
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<AiAPI.ModelSelectionVO>();

  const providerOptions = useMemo(
    () =>
      (selection?.supportedProviders?.length
        ? selection.supportedProviders
        : (['google', 'deepseek', 'qwen'] as AiAPI.ModelProvider[])
      ).map((provider) => ({
        label: PROVIDER_LABELS[provider] || provider,
        value: provider,
      })),
    [selection?.supportedProviders],
  );

  const loadSelection = async () => {
    setLoading(true);
    try {
      setSelection(await getAiModelSelection());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSelection();
  }, []);

  return (
    <PageContainer title="AI模型">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="当前供应商">
            {selection?.provider ? (
              <Tag color="processing">
                {PROVIDER_LABELS[selection.provider] || selection.provider}
              </Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="当前模型">
            {selection?.model || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {selection?.updatedAt?.replace('T', ' ') || '-'}
          </Descriptions.Item>
        </Descriptions>
        <ProForm<AiAPI.ModelSelectionUpdateBO>
          grid
          initialValues={{ provider: selection?.provider || 'google' }}
          key={selection?.provider || 'empty'}
          layout="horizontal"
          onFinish={async (values) => {
            const next = await updateAiModelSelection(values);
            setSelection(next);
            message.success('保存成功');
            return true;
          }}
          submitter={{
            render: (_, dom) => (
              <Space>
                {dom}
                <Button loading={loading} onClick={loadSelection}>
                  刷新
                </Button>
              </Space>
            ),
            searchConfig: {
              submitText: '保存',
              resetText: '重置',
            },
          }}
        >
          <ProFormSelect
            colProps={{ md: 10, sm: 24 }}
            label="默认供应商"
            name="provider"
            options={providerOptions}
            rules={[{ required: true, message: '请选择默认供应商' }]}
          />
          <ProFormText
            colProps={{ md: 10, sm: 24 }}
            disabled
            label="当前模型"
            name="model"
            placeholder={selection?.model || '-'}
          />
        </ProForm>
      </Space>
    </PageContainer>
  );
}
