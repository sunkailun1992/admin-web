import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import styles from './index.less';

export type StorageFormValues = {
  name: string;
  provider: AiAPI.StorageProvider;
  endpoint?: string;
  bucket?: string;
  region?: string;
  uploadEnabled: boolean;
  credentialAction: 'KEEP' | 'REPLACE';
  accessKeyId?: string;
  secretKey?: string;
};
export default function StorageConfigurationDrawer({
  open,
  current,
  capabilities,
  disabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  current?: AiAPI.StorageConfigurationVO;
  capabilities: AiAPI.StorageCapabilitiesVO;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (values: StorageFormValues) => boolean;
}) {
  const [form] = Form.useForm<StorageFormValues>();
  const providerCode = Form.useWatch('provider', form);
  const credentialAction = Form.useWatch('credentialAction', form);
  const provider = capabilities.providers.find(
    (entry) => entry.code === (current?.provider || providerCode),
  );
  const [confirmedValues, setConfirmedValues] = useState<StorageFormValues>();
  useEffect(() => {
    form.resetFields();
    setConfirmedValues(undefined);
    if (open)
      form.setFieldsValue(
        current
          ? {
              name: current.name,
              provider: current.provider,
              uploadEnabled: current.uploadEnabled,
              credentialAction: 'KEEP',
            }
          : {
              provider: capabilities.providers.find(
                (entry) => entry.availability === 'AVAILABLE',
              )?.code,
              uploadEnabled: true,
              credentialAction: 'REPLACE',
            },
      );
    return () => {
      form.resetFields();
    };
  }, [open, current?.id, form]);
  const close = () => {
    setConfirmedValues(undefined);
    form.resetFields();
    onClose();
  };
  return (
    <>
      <Drawer
        title={current ? '编辑文件存储配置' : '新增文件存储配置'}
        open={open}
        width={560}
        destroyOnClose
        onClose={close}
        extra={
          <Space>
            <Button onClick={close}>取消</Button>
            <Button
              type="primary"
              disabled={disabled}
              onClick={() => form.submit()}
            >
              保存配置
            </Button>
          </Space>
        }
      >
        <Alert
          showIcon
          type="info"
          message="配置面向所有租户"
          description="凭据仅单向提交，不读取旧密钥。保存不等于读写连接已验证；停用上传后历史文件仍按原平台读取。"
          className={styles.section}
        />
        {current ? (
          <Descriptions column={1} size="small" className={styles.section}>
            <Descriptions.Item label="平台标识">
              <span className={styles.longValue}>{current.platform}</span>
            </Descriptions.Item>
            <Descriptions.Item label="供应商">
              {provider?.label || current.provider}
            </Descriptions.Item>
            <Descriptions.Item label="存储地址">
              <span className={styles.longValue}>{current.endpoint}</span>
            </Descriptions.Item>
            <Descriptions.Item label="桶 / 区域">
              <span className={styles.longValue}>
                {current.bucket}
                {current.region ? ` / ${current.region}` : ''}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="已有引用">
              {current.referenceCount} 个；对象位置固定，迁移请新建配置
            </Descriptions.Item>
          </Descriptions>
        ) : null}
        <Form<StorageFormValues>
          form={form}
          layout="vertical"
          disabled={disabled}
          preserve={false}
          autoComplete="off"
          onFinish={setConfirmedValues}
        >
          <Form.Item
            label="显示名称"
            name="name"
            rules={[
              {
                required: true,
                whitespace: true,
                max: 120,
                message: '请输入不超过 120 字符的名称',
              },
            ]}
          >
            <Input maxLength={120} />
          </Form.Item>
          {!current ? (
            <>
              <Form.Item
                label="供应商类型"
                name="provider"
                rules={[
                  { required: true, message: '请选择当前服务可用的供应商' },
                ]}
              >
                <Select
                  options={capabilities.providers.map((entry) => ({
                    value: entry.code,
                    label: `${entry.label}${
                      entry.availability === 'AVAILABLE'
                        ? ''
                        : '（当前服务不可用）'
                    }`,
                    disabled: entry.availability !== 'AVAILABLE',
                  }))}
                />
              </Form.Item>
              {provider?.endpointRequired ? (
                <Form.Item
                  label="存储服务地址"
                  name="endpoint"
                  extra="完整 http(s) origin，不包含路径、账号、查询参数或签名。云供应商使用 HTTPS；私有地址须在后端允许范围。"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: '请输入存储服务地址',
                    },
                  ]}
                >
                  <Input
                    maxLength={2048}
                    placeholder="https://storage.example.invalid"
                  />
                </Form.Item>
              ) : null}
              <Form.Item
                label="存储桶"
                name="bucket"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    max: 255,
                    message: '请输入存储桶名称',
                  },
                ]}
              >
                <Input maxLength={255} />
              </Form.Item>
              <Form.Item
                label="区域"
                name="region"
                extra={
                  provider?.code === 'TENCENT_COS'
                    ? '腾讯 COS 使用桶与区域生成服务地址。'
                    : '按供应商要求填写；未要求时可留空。'
                }
                rules={[
                  {
                    required: provider?.regionRequired,
                    whitespace: true,
                    message: '该供应商需要区域',
                  },
                ]}
              >
                <Input maxLength={128} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            label="允许新上传"
            name="uploadEnabled"
            valuePropName="checked"
            extra="停用只阻止新写入，不关闭已有文件读取。"
          >
            <Switch />
          </Form.Item>
          {current ? (
            <Form.Item label="凭据操作" name="credentialAction">
              <Select
                onChange={(value) => {
                  if (value === 'KEEP')
                    form.setFieldsValue({
                      accessKeyId: undefined,
                      secretKey: undefined,
                    });
                }}
                options={[
                  { value: 'KEEP', label: '保留现有凭据，不提交密钥字段' },
                  { value: 'REPLACE', label: '替换凭据，成对输入新值' },
                ]}
              />
            </Form.Item>
          ) : null}
          {!current || credentialAction === 'REPLACE' ? (
            <>
              <Form.Item
                label="Access Key ID / Secret ID"
                name="accessKeyId"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: '请输入新的访问标识',
                  },
                ]}
              >
                <Input.Password autoComplete="new-password" maxLength={4096} />
              </Form.Item>
              <Form.Item
                label="Secret Key / Access Key Secret"
                name="secretKey"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: '请输入新的密钥',
                  },
                ]}
              >
                <Input.Password autoComplete="new-password" maxLength={4096} />
              </Form.Item>
            </>
          ) : (
            <Typography.Paragraph type="secondary">
              当前仅显示“凭据已配置”状态，不回显、读取或填充旧密钥。
            </Typography.Paragraph>
          )}
        </Form>
      </Drawer>
      <Modal
        title={current ? '保存全局存储配置？' : '创建全局存储配置？'}
        open={!!confirmedValues}
        okText="确认保存"
        cancelText="返回编辑"
        okButtonProps={{ disabled }}
        onCancel={() => setConfirmedValues(undefined)}
        onOk={() => {
          if (!confirmedValues || disabled) return;
          const values = confirmedValues;
          setConfirmedValues(undefined);
          if (onSubmit(values)) form.resetFields();
        }}
      >
        <Typography.Paragraph>
          此配置用于所有租户的文件存储。保存只确认配置操作，实际读写与私有访问仍需单独探测。
        </Typography.Paragraph>
        {confirmedValues?.credentialAction === 'REPLACE' ? (
          <Alert
            type="warning"
            showIcon
            message="将提交成对的新凭据；不会展示密钥内容。"
          />
        ) : null}
      </Modal>
    </>
  );
}
