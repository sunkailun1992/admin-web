import { DEFAULT_TENANT_ID } from '@/constants/auth';
import { login } from '@/services/auth';
import { setAccessToken, setStoredLoginInfo } from '@/utils/auth';
import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { message } from 'antd';
import styles from './index.less';

export default function LoginPage() {
  const { setInitialState } = useModel('@@initialState');

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.form}>
            <div className={styles.brand}>
              <h1 className={styles.title}>User Admin</h1>
              <div className={styles.subtitle}>租户、用户、角色与权限资源管理</div>
            </div>
            <LoginForm<API.LoginRequest>
              initialValues={{
                tenantId: DEFAULT_TENANT_ID,
                username: 'admin',
              }}
              submitter={{
                searchConfig: {
                  submitText: '登录',
                },
              }}
              onFinish={async (values) => {
                const response = await login(values);
                const loginInfo = response.data;
                setAccessToken(loginInfo.token);
                setStoredLoginInfo(loginInfo);
                await setInitialState({
                  currentUser: {
                    ...loginInfo,
                    name: loginInfo.nickname || loginInfo.username,
                  },
                  name: loginInfo.nickname || loginInfo.username,
                });
                message.success('登录成功');
                history.push('/dashboard');
                return true;
              }}
            >
              <ProFormText
                fieldProps={{
                  prefix: <SafetyCertificateOutlined />,
                }}
                label="租户 ID"
                name="tenantId"
                placeholder="默认租户 100"
                rules={[{ required: true, message: '请输入租户 ID' }]}
              />
              <ProFormText
                fieldProps={{
                  prefix: <UserOutlined />,
                }}
                label="用户名"
                name="username"
                placeholder="请输入用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              />
              <ProFormText.Password
                fieldProps={{
                  prefix: <LockOutlined />,
                }}
                label="密码"
                name="password"
                placeholder="请输入密码"
                rules={[{ required: true, message: '请输入密码' }]}
              />
            </LoginForm>
          </div>
        </div>
        <div className={styles.visual}>
          <div className={styles.visualContent}>
            <h2 className={styles.visualTitle}>认证中心管理台</h2>
            <div className={styles.visualText}>
              按后端用户中心模型构建，覆盖登录认证、租户隔离、用户管理、角色授权和前后端资源维护。
            </div>
            <div className={styles.metricGrid}>
              <div className={styles.metric}>
                <div className={styles.metricValue}>4</div>
                <div className={styles.metricLabel}>核心资源</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricValue}>2</div>
                <div className={styles.metricLabel}>授权关系</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricValue}>JWT</div>
                <div className={styles.metricLabel}>统一认证</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
