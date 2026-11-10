import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import styles from './index.less';
export default function StorageSettingsPanel({
  settings,
  capabilities,
  configurations,
  disabled,
  onSubmit,
}: {
  settings: AiAPI.StorageSettingsVO;
  capabilities: AiAPI.StorageCapabilitiesVO;
  configurations: AiAPI.StorageConfigurationVO[];
  disabled: boolean;
  onSubmit: (
    values: Pick<
      AiAPI.StorageSettingsVO,
      | 'defaultPlatform'
      | 'uploadTtlSeconds'
      | 'viewTtlSeconds'
      | 'maxUploadBytes'
    >,
  ) => boolean;
}) {
  const [form] = Form.useForm<AiAPI.StorageSettingsVO>();
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<AiAPI.StorageSettingsVO>();
  useEffect(() => {
    form.setFieldsValue(settings);
    setDirty(false);
    setConfirmation(undefined);
  }, [settings.version, form]);
  const options = configurations
    .filter(
      (entry) =>
        entry.uploadEnabled &&
        entry.runtimeStatus === 'APPLIED' &&
        entry.appliedRevision === entry.configRevision,
    )
    .map((entry) => ({
      value: entry.platform,
      label: `${entry.name} · ${entry.platform}`,
    }));
  if (
    settings.defaultPlatform &&
    !options.some((entry) => entry.value === settings.defaultPlatform)
  )
    options.unshift({
      value: settings.defaultPlatform,
      label: `当前平台：${settings.defaultPlatform}`,
    });
  return (
    <Card title="默认存储与私有访问策略" size="small">
      <Descriptions
        size="small"
        column={{ xs: 1, sm: 2 }}
        className={styles.section}
      >
        <Descriptions.Item label="当前默认平台">
          <span className={styles.longValue}>
            {settings.defaultPlatform || '尚未设置，不能新上传'}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="策略版本">
          {settings.version}
        </Descriptions.Item>
        <Descriptions.Item label="旧空平台文件映射">
          <span className={styles.longValue}>
            {settings.legacyNullPlatform || '未配置'}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="对象基础目录">
          <span className={styles.longValue}>
            {settings.baseDir || '未设置'}
          </span>
        </Descriptions.Item>
      </Descriptions>
      <Form
        form={form}
        layout="vertical"
        className={styles.policy}
        disabled={disabled}
        onValuesChange={() => setDirty(true)}
        onFinish={setConfirmation}
      >
        <Form.Item
          label="默认上传平台"
          name="defaultPlatform"
          extra="可选项来自当前已加载页，且须已生效并允许新上传；切换不搬移旧文件。"
        >
          <Select options={options} placeholder="请先新增并启用存储配置" />
        </Form.Item>
        <div className={styles.policyGrid}>
          <Form.Item
            label="上传签名有效期（秒）"
            name="uploadTtlSeconds"
            rules={[
              {
                required: true,
                type: 'integer',
                min: capabilities.limits.uploadTtlSeconds.min,
                max: capabilities.limits.uploadTtlSeconds.max,
              },
            ]}
          >
            <InputNumber
              min={capabilities.limits.uploadTtlSeconds.min}
              max={capabilities.limits.uploadTtlSeconds.max}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            label="查看签名有效期（秒）"
            name="viewTtlSeconds"
            rules={[
              {
                required: true,
                type: 'integer',
                min: capabilities.limits.viewTtlSeconds.min,
                max: capabilities.limits.viewTtlSeconds.max,
              },
            ]}
          >
            <InputNumber
              min={capabilities.limits.viewTtlSeconds.min}
              max={capabilities.limits.viewTtlSeconds.max}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </div>
        <Form.Item
          label="最大文件大小（字节）"
          name="maxUploadBytes"
          extra="50 MiB = 52,428,800 字节；服务端仍会按实际内容与权限校验。"
          rules={[
            {
              required: true,
              type: 'integer',
              min: capabilities.limits.maxUploadBytes.min,
              max: capabilities.limits.maxUploadBytes.max,
            },
          ]}
        >
          <InputNumber
            min={capabilities.limits.maxUploadBytes.min}
            max={capabilities.limits.maxUploadBytes.max}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Space wrap>
          <Button
            type="primary"
            htmlType="submit"
            disabled={disabled || !dirty}
          >
            保存策略
          </Button>
          <Button
            disabled={disabled || !dirty}
            onClick={() => {
              form.setFieldsValue(settings);
              setDirty(false);
            }}
          >
            还原已读取值
          </Button>
          <Typography.Text type="secondary">
            私有访问固定开启，不提供匿名公开开关。
          </Typography.Text>
        </Space>
      </Form>
      <Modal
        title="更新全局存储策略？"
        open={!!confirmation}
        okText="确认更新"
        cancelText="取消"
        okButtonProps={{ disabled }}
        onCancel={() => setConfirmation(undefined)}
        onOk={() => {
          if (disabled || !confirmation) return;
          if (onSubmit(confirmation)) setConfirmation(undefined);
        }}
      >
        <Alert
          showIcon
          type="warning"
          message="影响所有租户后续文件上传与签名策略"
          description="对象不迁移；历史文件继续按原平台读取。变更使用策略版本核对，冲突时必须重新读取。"
        />
      </Modal>
    </Card>
  );
}
