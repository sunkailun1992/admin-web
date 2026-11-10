import { uploadRagDocument } from '@/services/rag';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Drawer,
  Form,
  Input,
  Space,
  Upload,
  message,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { uploadGraphNotice } from '../Graph/graphModel';
import { createDocumentRequestGate } from './documentModel';
import styles from './index.less';
import { RAG_UPLOAD_ACCEPT, validateRagUpload } from './uploadValidation';

type Props = {
  knowledgeBase?: string;
  identityScope: string;
  onClose: () => void;
  onUploaded: () => void;
};

export default function UploadDocumentDrawer({
  knowledgeBase,
  identityScope,
  onClose,
  onUploaded,
}: Props) {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<RagAPI.DocumentIngestionVO>();
  const [failed, setFailed] = useState(false);
  const gate = useRef(createDocumentRequestGate());
  const liveScope = useRef(identityScope);
  liveScope.current = identityScope;
  useEffect(() => () => gate.current.cancel(), []);

  const submit = async (values: {
    knowledgeBase: string;
    documentCode?: string;
    title?: string;
  }) => {
    const selected = fileList[0]?.originFileObj;
    if (!selected) return void message.warning('请选择文档');
    const invalid = validateRagUpload(selected);
    if (invalid) return void message.warning(invalid);
    const request = gate.current.begin(identityScope);
    const body = new FormData();
    body.append('file', selected);
    body.append('knowledgeBase', values.knowledgeBase.trim());
    if (values.documentCode?.trim())
      body.append('documentCode', values.documentCode.trim());
    if (values.title?.trim()) body.append('title', values.title.trim());
    setUploading(true);
    setFailed(false);
    try {
      const response = await uploadRagDocument(body, request.signal);
      if (!request.isCurrent(liveScope.current)) return;
      if (
        !response.data?.document?.documentId ||
        !response.data.validation?.valid
      ) {
        throw new Error('Upload result is not validated');
      }
      setResult(response.data);
      onUploaded();
    } catch {
      if (request.isCurrent(liveScope.current)) setFailed(true);
    } finally {
      if (request.isCurrent(liveScope.current)) setUploading(false);
    }
  };
  const notice = result ? uploadGraphNotice(result) : undefined;

  return (
    <Drawer
      open
      title="上传知识文档"
      width="min(620px, 100vw)"
      onClose={onClose}
      closable={!uploading}
      maskClosable={!uploading}
      keyboard={!uploading}
      footer={
        <Space className={styles.drawerFooter}>
          <Button onClick={onClose} disabled={uploading}>
            {result ? '完成' : '关闭'}
          </Button>
          {result ? (
            <Button
              type="primary"
              onClick={() => {
                setResult(undefined);
                setFileList([]);
                form.setFieldsValue({
                  title: undefined,
                  documentCode: undefined,
                });
              }}
            >
              继续上传
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
              onClick={() => form.submit()}
            >
              上传并校验
            </Button>
          )}
        </Space>
      }
    >
      {result ? (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="success"
            message={
              result.idempotent ? '已复用相同文件的向量' : '文档上传并校验完成'
            }
          />
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="文档">
              {result.document.title}
            </Descriptions.Item>
            <Descriptions.Item label="知识库">
              {result.document.knowledgeBase}
            </Descriptions.Item>
            <Descriptions.Item label="版本">
              v{result.document.documentVersion}
            </Descriptions.Item>
            <Descriptions.Item label="有效切片">
              {result.validation.validPointCount}
            </Descriptions.Item>
          </Descriptions>
          {notice && (
            <Alert showIcon type={notice.type} message={notice.message} />
          )}
        </Space>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          disabled={uploading}
          initialValues={{
            knowledgeBase: knowledgeBase || 'general-knowledge',
          }}
        >
          <Form.Item label="文档文件" required>
            <Upload.Dragger
              accept={RAG_UPLOAD_ACCEPT}
              maxCount={1}
              fileList={fileList}
              beforeUpload={(file) => {
                const invalid = validateRagUpload(file);
                if (invalid) {
                  message.warning(invalid);
                  return Upload.LIST_IGNORE;
                }
                return false;
              }}
              onChange={({ fileList: next }) => setFileList(next.slice(-1))}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p>拖入文件或点击选择</p>
              <p className={styles.secondaryText}>
                XLSX、DOCX、PDF、PNG、JPG/JPEG，单文件不超过 20 MB
              </p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item
            label="知识库编码"
            name="knowledgeBase"
            rules={[
              { required: true, message: '请输入目标知识库' },
              {
                pattern: /^[A-Za-z0-9_-]{1,64}$/,
                message: '仅允许字母、数字、下划线和连字符',
              },
            ]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item label="文档标题" name="title">
            <Input maxLength={120} placeholder="留空使用文件名" />
          </Form.Item>
          <Form.Item
            label="文档编码"
            name="documentCode"
            extra="使用相同编码上传新内容时生成新版本。"
            rules={[
              {
                pattern: /^[A-Za-z0-9_-]{1,64}$/,
                message: '仅允许字母、数字、下划线和连字符',
              },
            ]}
          >
            <Input maxLength={64} placeholder="留空自动生成" />
          </Form.Item>
          <Collapse
            ghost
            items={[
              {
                key: 'help',
                label: '格式、版本与重复处理',
                children:
                  'Word 和 Excel 保留结构化来源，PDF 和图片依赖服务端解析与 OCR。同一文件复用向量；新版本替换旧版本的检索状态。图谱构建单独记录，不影响已通过的向量上传。',
              },
            ]}
          />
          {uploading && (
            <Alert showIcon type="info" message="正在上传并校验，请等待结果" />
          )}
          {failed && (
            <Alert
              showIcon
              type="error"
              message="上传结果未能确认"
              description="请先刷新文档列表核对结果，再决定是否重新上传。"
            />
          )}
        </Form>
      )}
    </Drawer>
  );
}
