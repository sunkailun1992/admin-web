# Admin Web

`admin-web` 是用户中心后台管理前端，基于 Ant Design Pro / Umi Max 构建，对接同级 `user` 后端项目。

本项目负责登录认证、租户管理、部门管理、用户管理、角色管理、权限资源管理，以及用户角色、角色资源、角色数据范围授权操作。

## AI 快速识别

```yaml
project:
  name: admin-web
  type: frontend-admin
  framework: Ant Design Pro + Umi Max
  language: TypeScript
  ui: Ant Design 5 + ProComponents
  packageManager: pnpm
backend:
  gatewayPath: ../gateway
  gatewayBaseUrl: http://localhost:8080
  localPath: ../user
  serviceName: user
  devBaseUrl: http://localhost:8080
  testBaseUrl: http://localhost:8080
  prodBaseUrl: http://localhost:8080
  userDirectUrl: http://localhost:7500
  requestMode: env-baseURL
auth:
  tenants: GET /auth/tenants
  login: POST /auth/sessions
  currentResources: GET /auth/current/resources
  tokenHeader: 'Authorization: Bearer <token>'
  tokenStorageKey: admin_web_access_token
permissions:
  backendManage: user:auth:manage
  frontendMenus:
    - menu:tenant
    - menu:dept
    - menu:user
    - menu:role
    - menu:resource
mainFiles:
  runtime: src/app.ts
  access: src/access.ts
  api: src/services/auth/index.ts
  types: src/services/auth/types.d.ts
  routes: .umirc.ts
  aiGuide: docs/ai-coding/AI_CODING_GUIDE.md
```

AI 处理本项目任务时，优先读取：

1. `README.md`
2. `AGENTS.md`
3. `docs/ai-coding/AI_CODING_GUIDE.md`
4. `.umirc.ts`
5. `src/app.ts`
6. `src/services/auth/index.ts`
7. 后端 `../user/README.md`

## 技术栈

- React
- TypeScript
- Umi Max
- Ant Design 5
- Ant Design ProComponents
- pnpm

## 业务范围

| 功能 | 前端页面 | 后端接口 |
| --- | --- | --- |
| 登录租户下拉 | `/login` | `GET /auth/tenants` |
| 登录 | `/login` | `POST /auth/sessions` |
| 当前资源 | 运行时初始化 | `GET /auth/current/resources` |
| 工作台 | `/dashboard` | 登录态与资源数据 |
| 租户管理 | `/system/tenant` | `GET /auth/manage/tenants`、`GET /auth/manage/tenants/options`、`POST /auth/manage/tenants`、`PUT/DELETE /auth/manage/tenants/{id}` |
| 部门管理 | `/system/dept` | `GET /auth/manage/depts`、`GET /auth/manage/depts/options`、`POST /auth/manage/depts`、`PUT/DELETE /auth/manage/depts/{id}` |
| 用户管理 | `/system/user` | `GET /auth/manage/users`、`GET /auth/manage/users/options`、`POST /auth/manage/users`、`PUT/DELETE /auth/manage/users/{id}` |
| 角色管理 | `/system/role` | `GET /auth/manage/roles`、`GET /auth/manage/roles/options`、`POST /auth/manage/roles`、`PUT/DELETE /auth/manage/roles/{id}` |
| 权限资源 | `/system/resource` | `GET /auth/manage/resources`、`GET /auth/manage/resources/options`、`POST /auth/manage/resources`、`PUT/DELETE /auth/manage/resources/{id}` |
| 用户绑定角色 | 用户管理弹窗 | `GET/PUT /auth/manage/users/{userId}/roles` |
| 角色绑定资源 | 角色管理弹窗 | `GET/PUT /auth/manage/roles/{roleId}/resources` |
| 角色数据范围 | 角色管理弹窗 | `GET/PUT /auth/manage/roles/{roleId}/data-scope-depts` |
| 编码生成 | 租户/部门/角色/资源表单 | `POST /auth/manage/codes` |

## 后端约定

后端统一响应结构：

```ts
interface ApiResponse<T> {
  success: boolean;
  code?: string | number;
  msg?: string;
  errorMessage?: string;
  data: T;
  timestamp?: string;
}
```

分页接口返回 MyBatis-Plus `Page<T>`，前端只消费：

```ts
records: T[]
total: number
current: number
size: number
```

后端默认数据：

```text
tenantId: 100
tenantName: 默认租户
username: admin
password: 123456
```

前端展示租户时使用租户名称，不直接向用户展示租户 ID；提交后端时仍使用 `tenantId`。

权限资源使用 `parentId` 组装树形结构。权限资源列表是树形表格，角色绑定资源是树形多选。

部门使用 `parentId` 组装树形结构。部门列表是树形表格，用户所属部门和角色自定义数据范围都使用部门树。

所有业务编码都由后端生成。前端表单只提供“生成”按钮调用 `POST /auth/manage/codes`，不在浏览器内拼接随机编码。

## 权限模型

登录返回：

- `permissions`：后端权限码，用于接口访问判断。
- `frontendResources`：前端菜单/页面资源，用于菜单展示控制。
- `backendResources`：后端接口资源，用于工作台展示。

当前管理台需要：

```text
user:auth:manage
```

前端菜单资源码：

```text
menu:tenant
menu:dept
menu:user
menu:role
menu:resource
```

权限判断集中在 `src/access.ts`。

## 目录说明

```text
src/
  app.ts                    # Umi 运行时配置、登录态初始化、请求拦截、错误处理
  access.ts                 # 路由权限判断
  components/TenantSelect/  # 租户选择组件
  constants/auth.ts         # 登录存储 key、枚举映射、默认租户常量
  hooks/useTenantOptions.ts # 租户名称展示与 valueEnum
  pages/Login/              # 登录页
  pages/Dashboard/          # 工作台
  pages/System/Tenant/      # 租户管理
  pages/System/User/        # 用户管理和绑定角色
  pages/System/Role/        # 角色管理和绑定资源
  pages/System/Resource/    # 权限资源管理
  services/auth/            # 后端接口封装和 API 类型
  utils/auth.ts             # Token 和登录信息存储
  utils/table.ts            # ProTable 查询参数、payload 清理
docs/
  ai-coding/
    README.md                       # AI 编码规范入口
    AI_CODING_GUIDE.md              # AI 编码规则
    AI_DIRECTORY_STRUCTURE_GUIDE.md # 目录管理规范
    AI_COMMENT_STYLE_GUIDE.md       # 注释规范
    AI_DESIGN_PATTERN_GUIDE.md      # 设计模式规范
    AI_ENGINEERING_GUARDRAILS.md    # 工程门禁规范
    SECURITY_CODING_SPEC.md         # 安全编码规范
```

## 本地启动

安装依赖：

```bash
pnpm install
```

启动前端：

```bash
pnpm dev
```

前端默认地址：

```text
http://localhost:8000
```

后端接口地址：

```text
.env.dev  -> UMI_APP_BACKEND_BASE_URL=http://localhost:8080
.env.test -> UMI_APP_BACKEND_BASE_URL=http://localhost:8080
.env.prod -> UMI_APP_BACKEND_BASE_URL=http://localhost:8080
```

前端运行时通过 `src/app.ts` 的 `request.baseURL` 直接请求 `UMI_APP_BACKEND_BASE_URL` 指向的网关。user-center 模块前缀在 `src/services/auth/index.ts` 统一拼接，现有接口路径仍保持 `/auth/**`，最终请求会成为 `/user/auth/**`，再由网关转发到 `user` 服务。当前 dev/test/prod 暂时都指向 `http://localhost:8080`；后续环境拆开时，只改对应 `.env.*` 文件。开发时需要先启动 `gateway` 和 `user`，并确保 `gateway` 监听 `8080`、`user` 监听 `7500`。如果浏览器出现 CORS 错误，需要在网关允许来自 `http://localhost:8000` 的跨域请求。

## 常用命令

```bash
pnpm dev        # 使用 .env.dev 启动开发服务
pnpm dev:test   # 使用 .env.test 启动开发服务
pnpm build:test # 使用 .env.test 构建
pnpm build      # 使用 .env.prod 构建
pnpm format     # 格式化
bash scripts/check-secrets.sh
```

如果开发服务异常退出后端口未释放：

```bash
lsof -i :8000 -P -n
kill -9 <PID>
```

## 开发规则

- 请求只写在 `src/services/auth/index.ts`。
- 类型只补在 `src/services/auth/types.d.ts`。
- 页面优先使用 `ProTable`、`ModalForm`、`ProForm*`。
- 新增业务字段前先确认后端 `BO`、`Query`、`VO`。
- 编辑接口必须携带后端返回的 `version`。
- 租户内资源提交必须携带 `tenantId`。
- 展示层尽量显示租户名称，避免直接暴露租户 ID。
- 编码字段使用后端生成接口，禁止前端自行生成。
- 不提交 `node_modules/`、`dist/`、`.turbopack/`、`src/.umi*`、`.idea/`、`*.iml`。

更完整的 AI 编码规范见 [docs/ai-coding/AI_CODING_GUIDE.md](docs/ai-coding/AI_CODING_GUIDE.md)。
