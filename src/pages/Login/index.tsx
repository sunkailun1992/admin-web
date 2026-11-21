import { redirectToLogin } from '@/utils/sessionLogin';
import { Button, Result } from 'antd';

/**
 * 登录失败页（/login?error）：网关登录回调失败时跳到这里（与网关 1.3.4 的约定）。这一页不检查会话、也不自动跳登录，
 * 回调一直失败时不会在网关与 Keycloak 之间整页循环；由用户点“重新登录”再走一遍网关登录。
 */
export default function LoginPage() {
  const failed = new URLSearchParams(window.location.search).has('error');
  return (
    <Result
      status={failed ? 'warning' : 'info'}
      title={failed ? '登录失败' : '请登录'}
      subTitle={
        failed
          ? '登录没有完成：可能在登录页停留太久，或浏览器拦截了站点 Cookie。请重新登录；仍然失败请联系管理员。'
          : '登录后才能使用管理后台。'
      }
      extra={
        <Button type="primary" onClick={() => redirectToLogin()}>
          重新登录
        </Button>
      }
    />
  );
}
