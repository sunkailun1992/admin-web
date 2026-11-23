# Admin Web

`admin-web` 是用户中心后台管理前端，对接同级 `user`、`message`、AI 与 RAG 后端，经同级 `gateway` 访问。它同时是一套可裂变的基础框架：各公司以后从这里裂变出自己的管理端，所以微前端、物料、主题、插件都按国际主流做法前期拆好。

`1.2.5` 起整个重写为国际主流方案（第6阶段，旧的 Umi / Ant Design 应用整体删除，不逐步淘汰）：pnpm 工作区加 Turborepo 单仓，Vite 8 与 React 19，Module Federation 2 微前端（一个主应用、四个子应用），shadcn/ui 与 Tailwind 4 物料包（Storybook、shadcn 注册表），DTCG 设计令牌经 Style Dictionary 生成主题，i18next 多语言。菜单、页面、接口契约、登录与权限规则与 1.2.4 对齐。每项选型都对照了 GitHub 上多个同类主流项目与官方文档，依据记在维护者的第6阶段设计文档里。

## AI 快速识别

```yaml
project:
  name: admin-web
  type: frontend-admin
  layout: pnpm workspace + Turborepo（apps/* 与 packages/*）
  language: TypeScript
  ui: shadcn/ui（Radix UI）+ Tailwind CSS 4，物料包 packages/ui
  microFrontends: Module Federation 2（主应用 shell，子应用 system、message、ai、rag）
  router: React Router 8（主应用唯一路由器，子应用经 ./routes 提供路由与菜单）
  data: TanStack Query 5、TanStack Table、react-hook-form + zod、axios
  i18n: i18next / react-i18next（zh-CN 默认，en-US 完整一份）
  runtime: Node 26
  packageManager: pnpm 12.21.0
  tests: Vitest（jsdom 与浏览器模式）+ Testing Library + MSW、Storybook 交互测试、Playwright
backend:
  gatewayPath: ../gateway
  gatewayBaseUrl: http://localhost:7100 # ADMIN_WEB_GATEWAY_URL，只给开发与预览代理
  userPath: ../user
  userDirectUrl: http://localhost:7500
  requestMode: same-origin（开发与预览由 Vite 代理转给网关）
auth:
  login: GET /oauth2/authorization/keycloak # 网关 BFF，跳 Keycloak 登录（授权码加 PKCE）
  logout: POST /logout # 网关回 202 与 Keycloak 注销地址
  currentResources: GET /auth/current/resources
  session: 网关会话 Cookie __Host-SESSION（前端不存令牌）
  csrf: 写请求带 X-XSRF-TOKEN（值取自 XSRF-TOKEN Cookie）
  tenant: X-Tenant-Id（选中的租户，能否访问由 user 核对）
permissions:
  backendManage: user:auth:manage
  frontendMenus: [menu:tenant, menu:dept, menu:user, menu:role, menu:resource]
mainFiles:
  shell: apps/shell/src
  remoteContract: packages/auth/src/types.ts（RemoteRoutes、MenuEntry）
  access: packages/auth/src/access.ts
  http: packages/api/src/client.ts（createHttpClient）
  remotesRegistry: apps/shell/apps.<mode>.json
  viteConfig: packages/config-vite/src/index.ts（defineAppConfig）
  aiGuide: docs/ai-coding/AI_CODING_GUIDE.md
```

AI 处理本项目任务时，优先读取 `AGENTS.md`、本文件、`docs/ai-coding/AI_CODING_GUIDE.md`，再读要改的子应用或共享包，以及后端 `../user/README.md`。

## 仓库结构

```text
apps/
  shell/     主应用（宿主）：布局、侧边栏菜单、页头（租户切换、消息铃铛位、语言、主题、账户菜单）、工作台、登录失败页
  system/    子应用：租户、部门、用户、角色、权限资源
  message/   子应用：消息发送；另向主应用暴露消息铃铛组件 ./Bell
  ai/        子应用：AI 模型路由（/ai/*）、统一配置的模型与能力、文件存储（/configuration/*）
  rag/       子应用：知识文档（向量管理、检索测试）、知识图谱（Cytoscape.js）
packages/
  ui/                物料：shadcn/ui 组件源码、业务组件、Storybook、shadcn 注册表（registry.json）
  theme/             设计令牌（DTCG）→ theme.css、tokens.ts（Style Dictionary）
  theme-emerald/     额外主题包：换主题就是换包
  api/               createHttpClient（拦截器、灰度头）、统一响应解包、TanStack Query 与列表工具
  auth/              会话（当前用户、资源、租户）、权限规则 access.ts、RequireAccess、子应用接入契约类型、单独运行外壳
  i18n/              i18next 初始化与各命名空间文案（locales/zh-CN、locales/en-US）
  config-vite/       Vite 预设 defineAppConfig：React、Tailwind、Module Federation、代理、环境变量、共享单例
  config-eslint/     ESLint 扁平配置：子应用引用边界、界面不写死中文
  config-typescript/ tsconfig 基础配置
  config-vitest/     各包测试共用的时限（用例上限、Testing Library 等待）
  test-utils/        MSW 处理器、按应用方式套好 Provider 的渲染
e2e/
  mock/      Playwright 固定数据一组（接口按 e2e/fixtures 回，进 CI）
  live/      Playwright 真实网关一组（只经维护者本机的全链路脚本运行）
  fixtures/  接口固定数据（与界面无关）
  support/   浏览器测试的公共准备：子应用清单、接口拦截、控制台收集
scripts/     e2e-serve.mjs、verify-independent-deploy.mjs、test-generator.mjs、check-secrets.sh
turbo/generators/  turbo gen remote：新建子应用的模板
docs/ai-coding/    AI 编码规范
```

## 微前端接入契约

- **子应用清单**：主应用启动时取运行时配置 `/apps.json`（来源 `apps/shell/apps.<mode>.json`，开发服务器直接给，构建时写进产物，部署时可按环境替换），每项是子应用名、`mf-manifest.json` 地址和负责的路由前缀。加子应用、换子应用地址都不用重新构建主应用。
- **路由与菜单**：每个子应用经 Module Federation 暴露 `./routes`，默认导出 `RemoteRoutes`（`packages/auth/src/types.ts`）：`routes` 是路由对象（页面懒加载），`menu` 是菜单元数据（路径、文案键 `labelKey`、所需权限标志 `access`、分组）。主应用先渲染布局与工作台，清单和各子应用的 `./routes` 在后台并行加载，谁好了谁的路由与菜单先挂上；路由器只建一次，子应用的页面由兜底路由按地址交给负责的子应用。
- **共享单例**：react、react-dom、react-router、@tanstack/react-query、i18next、react-i18next、sonner 与 `@admin-web/{ui,api,auth,i18n}`，版本由 pnpm catalog 统一（`singleton` 加 `requiredVersion`），见 `packages/config-vite/src/shared.ts`。
- **故障隔离**：慢的、坏的子应用只影响它自己的域：还在加载时菜单与页面显示加载中，加载失败或 8 秒没加载好时菜单标为不可用、页面显示错误页与“重试”，其它域照常；清单读不到时页面显示“重试”，不当成页面不存在；清单里格式不对的一项记日志跳过，不连累别的子应用。加载用运行时插件 @module-federation/retry-plugin 重试；主应用里加载远程模块（如消息铃铛）等清单读到、子应用登记好再加载。
- **独立部署**：只重建一个子应用，主应用 `dist` 不变，运行中的主应用就用上新版子应用；`pnpm test:deploy` 验证这一点（CI 也跑）。
- **单独运行**：每个子应用有一个只在开发时用的最小外壳（`src/dev/main.tsx`，经 `StandaloneShell`），配同样的代理；登录统一到主应用的 8000 端口完成，localhost 的 Cookie 不分端口。
- **样式**：主题变量与 Tailwind 基础样式只由主应用加载一次；子应用只带自己用到的工具类，配置相同，重复不冲突。

## 业务范围

| 功能 | 页面 | 子应用 | 后端接口 |
| --- | --- | --- | --- |
| 登录 | 网关 `/oauth2/authorization/keycloak` | — | Keycloak 登录页（前端只有登录失败页 `/login?error`） |
| 当前资源 | 主应用启动时 | shell | `GET /auth/current/resources`、`GET /auth/current/tenants` |
| 工作台 | `/dashboard` | shell | 登录态与资源数据 |
| 租户管理 | `/system/tenant` | system | `GET /auth/manage/tenants`、`GET /auth/manage/tenants/options`、`POST /auth/manage/tenants`、`PUT/DELETE /auth/manage/tenants/{id}` |
| 部门管理 | `/system/dept` | system | `GET /auth/manage/depts`、`GET /auth/manage/depts/options`、`POST /auth/manage/depts`、`PUT/DELETE /auth/manage/depts/{id}` |
| 用户管理 | `/system/user` | system | `GET /auth/manage/users`、`GET /auth/manage/users/options`、`POST /auth/manage/users`、`PUT/DELETE /auth/manage/users/{id}` |
| 角色管理 | `/system/role` | system | `GET /auth/manage/roles`、`GET /auth/manage/roles/options`、`POST /auth/manage/roles`、`PUT/DELETE /auth/manage/roles/{id}` |
| 权限资源 | `/system/resource` | system | `GET /auth/manage/resources`、`GET /auth/manage/resources/options`、`POST /auth/manage/resources`、`PUT/DELETE /auth/manage/resources/{id}` |
| 用户绑定角色 | 用户管理弹窗 | system | `GET/PUT /auth/manage/users/{userId}/roles` |
| 角色绑定资源 | 角色管理弹窗 | system | `GET/PUT /auth/manage/roles/{roleId}/resources` |
| 角色数据范围 | 角色管理弹窗 | system | `GET/PUT /auth/manage/roles/{roleId}/data-scope-depts` |
| 编码生成 | 租户/部门/角色/资源表单 | system | `POST /auth/manage/codes` |
| 消息发送与铃铛 | `/message/send`、页头铃铛 | message | `/message/messages/**` |
| AI 模型路由 | `/ai/model` | ai | `GET/PUT /api/ai/model-selection` |
| 模型与能力 | `/configuration/models` | ai | `GET /api/ai/model-control-plane`；复用模型路由 |
| 文件存储 | `/configuration/storage` | ai | `GET /api/ai/storage-capabilities`、`GET/POST /api/ai/storage-configurations`、`PUT/DELETE /{id}`、`GET/PUT /api/ai/storage-settings`、显式探测与操作只读查回 |
| 知识文档 | `/rag-knowledge/documents` | rag | `POST/GET /api/rag/documents`、校验、停用、切片与检索接口 |
| 知识图谱 | `/rag-knowledge/graph` | rag | `GET /api/rag/graphs`、`POST /api/rag/graphs/sync`、构建与提交查回 |

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

分页接口返回 MyBatis-Plus `Page<T>`，前端只消费 `records`、`total`、`current`、`size`。`@admin-web/api` 负责解包：`success` 为 false 时抛出带后端提示、状态与错误码的 `ApiError`，提示原样显示。

- 展示租户用租户名称，`tenantId` 只作为接口内部字段。
- 部门、权限资源按 `parentId` 组装树（树形表格、树形选择，按 WAI-ARIA 树形模式）。
- 业务编码都由后端生成：表单只提供“生成”按钮调用 `POST /auth/manage/codes`，不在浏览器里拼随机编码。
- 更新接口必须带后端返回的 `version`（MyBatis-Plus 乐观锁）。

## 权限模型

`GET /auth/current/resources` 返回（按活动租户）`permissions`（后端权限码）、`frontendResources`（前端菜单/页面资源）、`backendResources`（后端接口资源，工作台展示）。

权限判断只在 `packages/auth/src/access.ts`：同时看权限码、`menu:*` 资源编码和管理员分类，产出 `canSeeTenant`、`canSeeRagGraph` 等标志；路由经 `RequireAccess`，菜单经 `MenuEntry.access`。用户中心管理页需要 `user:auth:manage` 与对应的 `menu:tenant`、`menu:dept`、`menu:user`、`menu:role`、`menu:resource`。

RAG 页面采用独立权限，不继承用户中心管理权限：

```text
menu:rag:document + rag:document:manage
rag:retrieval:use
menu:rag:graph + rag:graph:view
rag:graph:manage
```

统一配置（模型与能力、文件存储）要求平台超级管理员身份与 `user:auth:manage`。前端只负责隐藏无权页面和动作；后端（RAG 服务的 `@PreAuthorize` 等）仍是最终授权边界。

## 本地开发

```bash
pnpm install
pnpm dev     # 同时起主应用（8000）与四个子应用（8101–8104）
```

打开 `http://localhost:8000`。开发与预览代理（`packages/config-vite/src/proxy.ts`）把业务接口前缀 `/auth`、`/user`、`/message`、`/report`、`/api` 与网关自己的 `/oauth2`、`/login/oauth2`、`/logout` 转给 `ADMIN_WEB_GATEWAY_URL`（本地 `http://localhost:7100`），保留 `Host`（网关据此生成回调地址 `http://localhost:8000/login/oauth2/code/keycloak`）；浏览器打开页面（Accept 含 `text/html`）不转发，交给单页应用路由（`/message` 既是页面也是接口前缀）。开发前先启动 `gateway`（依赖 NAS 上的 Keycloak）与 `user`。生产部署也必须让前端与网关同源，反向代理按同样的前缀转发，并让 `/login` 落到单页应用。

| 应用    | 开发端口 | 预览端口 |
| ------- | -------- | -------- |
| shell   | 8000     | 8001     |
| system  | 8101     | 8201     |
| message | 8102     | 8202     |
| ai      | 8103     | 8203     |
| rag     | 8104     | 8204     |

只改一个子应用时可以单独跑它：`pnpm --filter @admin-web/system dev`，打开 `http://localhost:8101`；没有网关会话时页面提示先在主应用（8000）登录。

各应用的构建环境变量在自己的 `.env.dev`、`.env.test`、`.env.prod`：`ADMIN_WEB_GATEWAY_URL`（只给代理，不进前端代码）、`VITE_RELEASE_VERSION`、`VITE_TRAFFIC_LANE`，按需再有灰度标签与权重。规则见 [ENVIRONMENT_CONFIG_SPEC.md](docs/ai-coding/ENVIRONMENT_CONFIG_SPEC.md)。IDEA 的运行配置保留在本机，不纳入 Git；运行配置选根目录 `package.json` 的 `dev` 脚本。

## 常用命令

```bash
pnpm dev             # 开发服务（.env.dev）
pnpm build:dev       # 全部应用按 .env.dev 构建（另有 build:test、build）
pnpm check           # 全套门禁：格式、lint、类型（含 e2e）、单元测试、build:dev
pnpm format          # 格式化（format:check 只检查）
pnpm lint            # ESLint，警告也算失败
pnpm typecheck       # 各包 tsc 与 e2e 的类型检查
pnpm test            # Vitest：单元、页面（浏览器模式）、物料故事
pnpm test:e2e        # Playwright 固定数据一组（build:dev 后起预览服务，主应用 8001）
pnpm test:deploy     # 独立部署验证：只重建 system，主应用不变也能用上新版
pnpm test:generator  # 新建子应用生成器检查（生成、typecheck、test、build 后还原）
bash scripts/check-secrets.sh
pnpm --filter @admin-web/ui storybook        # 物料文档与交互测试（6006）
pnpm --filter @admin-web/ui registry:build   # 产出 shadcn 注册表到 packages/ui/public/r
pnpm turbo gen remote                        # 新建子应用
```

真实网关一组浏览器测试（`pnpm test:e2e:test`）只经维护者本机的全链路脚本 `run_chain_verify.py --admin-web-e2e` 运行：脚本把测试账号口令放进环境变量；后端服务要先起好；Playwright 先 `build:test`，主应用在 8000 端口（Keycloak 登记的回调地址）预览，8000 被占用时直接报错。

## 物料、主题与插件

- **物料**：`packages/ui` 按 shadcn/ui 官方单仓做法放组件源码，另有业务组件：页面容器、服务端分页数据表（TanStack Table）、表单弹窗与侧边面板（react-hook-form + zod）、编码输入、确认操作、空状态、树形选择、上传等。每个物料有 Storybook 故事（文档、交互测试、无障碍检查）。
- **注册表**：`registry.json` 按 shadcn 注册表格式列出业务组件、增删改查页模板 `crud-page` 与两个主题；裂变出去的项目用 `npx shadcn add <注册表地址>/<条目>.json` 取用（托管地址以后再定）。
- **主题**：令牌源文件 `packages/theme/tokens/*.json`（DTCG 格式，浅色、暗色），Style Dictionary 生成 `theme.css`（变量名与 shadcn/ui 一致，经 Tailwind 4 的 `@theme inline` 映射）与 `tokens.ts`（图表、图谱等非 CSS 场景）。应用样式入口引入哪个主题包就用哪套主题；浅色、暗色、跟随系统只是个人偏好，记在本地存储。
- **插件**：构建时由 `@admin-web/config-vite` 的 `defineAppConfig({ name, role, exposes, devPort, previewPort })` 组合 React、Tailwind、Module Federation、代理与环境变量；运行时用 Module Federation 运行时插件重试加载。
- **加一个子应用**：`pnpm turbo gen remote` 生成骨架（Vite 与 Module Federation 配置、路由、文案、测试与增删改查页）；在 `apps/shell/apps.<mode>.json` 登记；需要按权限显示时，后端加资源编码或权限码，并在 `access.ts` 加标志。

## 工具链与门禁

- Node 26（`engines`）与 pnpm 12.21.0（`packageManager`）。pnpm 12 是原生二进制，用 npm 11 全局安装时要放行安装脚本：`npm install -g --allow-scripts=pnpm pnpm@12.21.0`。依赖版本统一在 `pnpm-workspace.yaml` 的 catalog；带构建脚本的依赖按 `allowBuilds` 逐个列明。
- TypeScript 6.0 只做类型检查，构建由 Vite 负责；`e2e/` 与 `playwright.config.ts` 由根任务 `typecheck:repo` 检查（Playwright 运行器本身不做类型检查）。
- ESLint 10 扁平配置（`@admin-web/config-eslint`）：官方 recommended 预设，加子应用之间的引用边界（不能伸进别的子应用或共享包的源码）与“界面文案不写死中日韩文字”两条规则。格式用 Prettier 3。
- 提交钩子：husky 加 lint-staged，对暂存文件跑 `eslint --fix` 与 `prettier --write`。
- CI（`.github/workflows/ci.yml`，Node 26，action 固定到完整提交 SHA）：安装、格式、lint、类型、单元测试、`build:dev`、固定数据一组浏览器测试（失败时上传 `e2e-out/`）、生成器检查、独立部署验证、密钥扫描；`main` 与 `codex/**` 分支推送都会跑。

## 会话与安全

请求认证由 `@admin-web/api` 的 `createHttpClient` 统一处理，每个应用各建一个客户端（`src/http.ts`）：前端不存也不发访问令牌（令牌只在网关会话里），请求去掉 `Authorization`、标成 XHR（`X-Requested-With`，未登录时网关回 401 JSON 而不是跳转），写请求带 `X-XSRF-TOKEN`，选中的租户放进 `X-Tenant-Id`，灰度头 `X-Release-Version`、`X-Traffic-Lane`（按需 `X-Canary-Tag`、`X-Canary-Weight`）取各应用自己的构建环境变量。任何请求 401 都整页跳网关登录入口（子应用单独运行时改为提示先在主应用登录）。

`@admin-web/auth` 在主应用启动时读 `/auth/current/resources` 判断是否已登录，选中的租户不再可用（403）时清掉选择、按归属租户重读一次；会话读不到但网关在时进入恢复页（可重试、可退出）。退出：先清掉选中的租户，`POST /logout`，网关回 202 与 Keycloak 注销地址后整页导航过去。

登录失败页：网关登录回调失败时跳到 `/login?error`，页面说明登录没有完成，只给“重新登录”按钮。这一页不读会话、不自动跳登录，否则回调一直失败时会在网关与 Keycloak 之间整页循环。

更多规则见 [SECURITY_CODING_SPEC.md](docs/ai-coding/SECURITY_CODING_SPEC.md)。

## 功能说明

### 统一配置

“模型与能力”只读 `GET /api/ai/model-control-plane` 返回的实际 deployment，按语言、向量、重排、OCR、语音、图片、视频分类；管理目录可读不等于模型健康，能力声明不等于业务接入。兼容 LiteLLM 原生别名：多个调用名称可以保留同一个 deployment ID，目录行按 `(id, modelName)` 稳定区分，页面分别显示去重的部署数与目录记录数。模型部署、供应商凭据、虚拟密钥、额度、用量与验证使用 LiteLLM 原生控制台的固定入口，不重做增删改查、不带令牌自动登录、不嵌 iframe。下方内嵌 AI 模型路由；RAG 索引绑定的模型与维度不提供热切换。

“文件存储”按后端 capabilities 提供 OSS、COS、MinIO/S3 兼容配置；位置创建后固定，迁移靠新建并切换默认。凭据 `KEEP` 不提交密钥字段，`REPLACE` 成对单向提交，关闭、提交、身份切换都清空表单；名称与上传开关没变且保留凭据时禁止保存。停用上传不关闭旧文件读取；默认或有引用的配置不能删除。保存版本、生效 revision 与实际读写探测分别显示，历史 revision 的成功不当作当前连接正常。默认平台、签名有效期（秒）与最大文件字节数经 settings 乐观锁更新，同时显示 MiB 与精确字节数；基础目录、旧空平台映射与私有访问只读。

存储的每次变更带 UUID v4 格式的 requestId（16 字节加密随机数），结果未知时只 `GET /api/ai/storage-operations/{requestId}` 查回，不自动重发。已知用户与租户时，同一标签页的 sessionStorage 只存 scope、requestId、动作与配置 ID，不存地址、表单或凭据；恢复时先查回，404 也不生成新提交，存储损坏或失败会阻止新写入。真实读写探测需要明确确认。探测与操作时间按浏览器本地时间显示 UTC 偏移与时区。

### 知识文档

列表工作台按知识库查询，可搜索标题、来源文件或编码，筛选状态与格式；上传、检索测试与命中来源使用独立的侧边面板。列表分页与筛选作用于已载入数据。检索必须明确提交，默认返回 6 条、可选 1–20 条；服务不可用不会显示成“没有匹配”。身份或知识库切换会中止旧请求并忽略迟到结果。

上传接受 XLSX、DOCX、PDF、PNG、JPG/JPEG，单文件最多 20 MiB；选择与提交时都校验扩展名、大小、文件名与浏览器报告的 MIME，没有可靠 MIME 时交给后端核对文件头。前置校验不替代后端权限、租户隔离与内容安全检查。上传用 `POST /api/rag/documents` multipart 契约；配套后端可追加 `graphBuild/graphStatus`，向量成功与图谱排队或失败分别提示，超时不自动重发。

“切片检视”读取 `GET /api/rag/documents/{documentId}/chunks?limit=20&cursor=...`，按后端不透明游标续读并缓存上一页，展示真实保存的来源名称、定位、章节、页码、区块类型、坐标、重复来源、OCR 能力（文字识别、表格结构、版面分析；`false` 显示“不支持”，缺失显示“未提供”）与切片正文。

“查看评估报告”在浏览器内读取 RAG 评估工具生成的 `schemaVersion=1` JSON（最大 2 MiB），也支持 `evaluation/live_compare.py` 的完整比较报告（Dense/Hybrid 并排）。文件不上传、不写入浏览器存储；读取器只接受报告定义的字段并核对计数与门禁结果，不合法的报告不回显内容。评估报告是历史记录，字段校验不等于来源真实性认证，门禁通过也不代表线上验收。

### 知识图谱

图谱用 Cytoscape.js 绘制：当前结果节点定位、缩放、适配与全屏（原生全屏，不可用时最大化）；节点与关系详情分为来源证据、属性与当前结果关联；图例与截断信息靠近画布，构建状态区分任务与已发布结果。选择节点不重建画布，视图按钮不触发构建。

读到 `backend=neo4j` 后展示 LlamaIndex 抽取、Neo4j 保存的 `ENTITY` 实体与 `RELATED_TO` 关系（以 `label` 显示具体语义），只提供实体筛选；旧后端的总览继续查看文档与概念，结构明细展示区段与记录。来源证据读 `properties.sources[]`、`sourceCount`、`sourceTruncated`，每项最多显示 8 条公开来源，摘录按普通文本最多 2000 字，`evidenceTruncated`、`evidenceNormalized` 分别提示已截断、格式已归一。证据带 `documentId` 且有 `menu:rag:document + rag:document:manage` 时可打开文档切片。

“重新构建图谱”需要 `rag:graph:manage` 并二次确认。每次明确操作生成不透明提交键；结果不确定时保留同一身份、租户、知识库下的键（同一标签页 sessionStorage 只存 scope 与键），先经只读提交查询查回原任务，不自动重复 POST；新后端返回 `buildId/status` 时每 2 秒续读到终态，只有 `SUCCEEDED` 刷新图谱。更换知识库、再次查询与离开页面会取消旧请求，迟到响应不覆盖当前视图。接口与离线验收说明见 [RAG_NEO4J_GRAPH.md](docs/ai-coding/RAG_NEO4J_GRAPH.md)。

## 版本记录

- `1.2.5`：按国际主流整个重写（本文件开头）。对使用者：菜单、页面、接口、登录与权限不变；对开发者：技术栈、目录与命令全部更换，旧的 Umi 写法不再适用。回退即部署 1.2.4 的产物，后端与网关不需要配合改动。
- `1.2.4` 及以前：Umi Max 与 Ant Design 应用。`1.2.4` 排序字段改名 `sort`；`1.2.2` 起 Node 26 与 pnpm 12 工具链；`1.2.1` 登录失败页；`1.1.x` 存储编辑与时间显示；`1.0.5`–`1.0.9` 图谱提交键、知识文档工作台、统一配置、LiteLLM 别名、requestId 对齐 UUID。详情见 Git 历史与 `docs/superpowers/` 下的设计与计划。
