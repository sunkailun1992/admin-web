import { createServiceClient } from '@admin-web/api';
import { client } from '../http.ts';

// 管理接口经网关的 /auth/**（USER_SERVICE_PREFIX 为空，不追加 /user），同源，不直连后端服务。
export const api = createServiceClient(client);
