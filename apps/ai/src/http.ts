import { createHttpClient, trafficFromEnv } from '@admin-web/api';
import { getSelectedTenantId, handleUnauthorized } from '@admin-web/auth';
import { toast } from 'sonner';

/** 本应用的请求客户端：灰度头取本应用构建时的 VITE_* 变量；401 与提示走共享的 auth 与 sonner。 */
export const client = createHttpClient({
  traffic: trafficFromEnv(import.meta.env),
  getTenantId: getSelectedTenantId,
  onUnauthorized: handleUnauthorized,
  notify: (message) => toast.error(message),
});
