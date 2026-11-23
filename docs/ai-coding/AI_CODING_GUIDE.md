# AI 代码编写指导规范

本文档用于约束 AI 在本项目中生成、修改和审查前端代码。项目基线（1.2.5 起）为 pnpm 工作区加 Turborepo 单仓、Vite 8、React 19、React Router 8、TypeScript 6、Module Federation 2、shadcn/ui 与 Tailwind CSS 4；工具链与门禁见 README「工具链与门禁」。

## 基本原则

新任务、完整功能、跨仓配套和分支清理按 AGENTS.md／BRANCHING_SPEC.md；修改版本先读 VERSIONING_SPEC.md，执行 1.2.9→1.3.0、1.9.9→2.0.0 的进位与占用检查。

- 先读后端接口、DTO、VO、权限码和现有前端结构，再写代码。
- 先读 `AI_AUTOMATION_WORKFLOW.md`，按需求说明、验收标准、开发手册、测试说明和交付说明组织自动化开发。
- 先读 `AI_ENGINEERING_GUARDRAILS.md`，按风险分级、Definition of Done、测试门禁、安全门禁和交付说明约束 AI 生成代码。
- 先读 `AI_DIRECTORY_STRUCTURE_GUIDE.md`，按单仓的应用与共享包边界管理目录。
- 先读 `AI_DESIGN_PATTERN_GUIDE.md`，按 React、TypeScript、Module Federation 与物料包的结构选择设计模式。
- 升级、选型和架构设计先查证国际主流做法，不为了缩小改动范围采用偷懒的写法（见 `AI_DESIGN_PATTERN_GUIDE.md`）。
- 不凭空新增接口字段、路由、权限码或状态值；字段必须来自后端代码、接口文档或明确需求。
- 前端不生成后端业务表、DDL 或数据库字段；涉及新增表先回到对应 Java 后端项目，按其 AI 表设计规范完成。
- 界面优先用 `@admin-web/ui` 的物料与业务组件；物料缺能力时先补进物料包（带故事与测试），不在应用里另起一套。
- 业务页面保持增删改查闭环：查询、新增、编辑、删除、错误提示、重新读取列表。
- 远程请求只写在各应用的 `src/services`，经本应用的 `src/http.ts` 客户端发出；页面不直接拼 axios/fetch。
- 会话、请求拦截、错误处理集中在 `@admin-web/api` 与 `@admin-web/auth`，应用里不另写一套。
- 不提交本地文件、构建产物、依赖目录、IDE 配置和缓存文件。
- 不在 README、AI 规范、配置、脚本、测试、示例和前端代码中写入个人电脑绝对路径、本机下载目录、本机 Node/JDK 路径或本机仓库完整路径。
- 目录关系使用 `../user`、`../gateway`、`../message`、`../utils` 这类相对路径；可变安装位置、缓存目录、导出目录或临时目录使用环境变量、前端配置、`~` 用户目录或 `<PLACEHOLDER>` 占位符。
- 提交前必须使用 `rg` 搜索本机用户名、用户目录、仓库根目录和系统盘路径关键字，检查是否残留本机路径。

## 多智能体协作规则

- 可以使用多个子智能体并行协作，但子智能体默认只能执行需求分析和项目学习，不直接修改代码。
- 大项目学习时，可以让多个 explorer 分别阅读子应用、共享包、后端接口、权限资源、Nacos/Gateway 配置和构建脚本；这类读多写少任务冲突小，收益高。
- 问题排查时，可以让多个 explorer 分别检查前端请求、后端接口、配置权限、数据库和日志；主智能体必须最后汇总证据并判断根因。
- 代码 Review 可以按安全风险、逻辑 bug、测试缺口、性能问题和可维护性拆分给多个 reviewer；结论必须由主智能体统一收口。
- 测试回归和日志分析可以并行：一个 agent 跑 `pnpm check`，一个 agent 分析失败日志，一个 agent 查最近改动；最终修复仍由主智能体或一个明确 worker 收口。
- 大功能可以拆给多个 worker 独立实现，但必须先划清写入边界：不同子应用（`apps/*`）是天然边界；同一个共享包、子应用接入契约、权限规则、根配置或 CI 必须由主智能体串行处理。
- 子智能体输出应包含读取范围、关键发现、风险点和建议，不应直接给出未经主智能体验证的最终结论。

## 安全编码规则

安全细则单独维护在 `SECURITY_CODING_SPEC.md`。新增或修改页面、按钮、请求客户端、会话、路由守卫、上传下载、富文本、脱敏、批量操作时，必须先阅读该文件并按检查清单验证。

## 注释要求

- AI 新增或修改 TypeScript、TSX、JavaScript、CSS、配置、脚本、测试和示例等编程内容时，必须遵守 `AI_COMMENT_STYLE_GUIDE.md`。
- 修改注释前先识别文件类型和框架上下文；规范未覆盖时，先查官方或主流规范并补充到注释规范文件。
- 优先让代码自解释，能用组件名、函数名、类型、常量和拆分后的状态表达的意图，不用注释补救。
- 注释解释长期维护需要知道的交互目的、权限边界、接口契约、状态流转和错误处理。
- 禁止逐行翻译式注释，禁止用注释保留废弃组件、旧 JSX、临时调试代码或整块旧实现。
- 注释必须保持缩进、对齐、换行和段落美观一致；不能为了补说明把页面、配置或样式文件弄乱。

## 设计模式要求

- AI 新增或重构 TypeScript、TSX、service、Hook、权限和状态代码前，必须遵守 `AI_DESIGN_PATTERN_GUIDE.md`。
- 页面复用优先用组件组合与物料包的业务组件。
- 远程接口统一经各应用 `src/services` 做服务适配层，页面不直接拼请求。
- 服务端状态用 TanStack Query（查询键按 `[应用, 资源, …]` 组织，写操作成功后按键失效重读）；会话与权限经 `@admin-web/auth` 的 Provider 与 Hook 取用；简单局部状态不引入全局状态库。
- 固定状态、分类、权限码和 HTTP 方法放常量映射（共享的放 `@admin-web/auth` 等共享包，本应用的放应用内常量文件），不写散落的 `if/else`。
- 禁止照搬 Java 式抽象类、Service Locator 和过深继承。

## 目录规范

```text
apps/
  shell/                     # 主应用：布局、菜单、页头、工作台、登录失败页、子应用加载
  <子应用>/
    src/
      routes.tsx             # 经 Module Federation 暴露的 ./routes：路由与菜单
      http.ts                # 本应用的请求客户端（createHttpClient）
      pages/<页面>/          # 路由页面与页面私有组件
      services/              # 接口函数与 types.ts
      lib/                   # 纯逻辑（模型、校验、状态映射），可单测
      dev/main.tsx           # 只在开发时用的单独运行外壳
    test/unit/               # jsdom 单元测试（MSW 在 Node 里拦截）
    test/pages/              # 真实浏览器里的页面测试（MSW 的 Service Worker 拦截）
packages/                    # 共享包：ui、theme、theme-emerald、api、auth、i18n、config-*、test-utils
e2e/                         # Playwright：mock、live、fixtures、support
```

页面目录按业务域组织，例如 `apps/system/src/pages/Tenant`、`apps/rag/src/pages/Graph`。目录边界细则见 `AI_DIRECTORY_STRUCTURE_GUIDE.md`。

## TypeScript 规范

- 禁止使用 `any` 绕过业务类型；确需兼容第三方库时范围必须最小。
- 后端统一响应建模为 `@admin-web/api` 的 `ApiResponse<T>`，用 `unwrap` 解包；`success=false` 抛 `ApiError`。
- 分页响应只消费 `records`、`total`（`PageResult<T>` / `Page<T>`），分页参数用 `toPageQuery` 转成后端的 `current`、`size`。
- 表单入参使用后端 `*BO` 类型，查询入参使用后端 `*Query` 类型，表格行使用后端 `*VO` 类型，写在本应用 `src/services/types.ts`；会话相关类型在 `@admin-web/auth`。
- 可选字段用 `?`，不要用空字符串表达缺失值；提交前用 `cleanPayload` 去掉 `undefined`。
- 外部输入（接口回包、文件内容、本地存储）在边界处校验或解码，不按类型断言直接信任。

## 物料与界面规范

- 列表页用 `DataTable`（TanStack Table，服务端分页）配 `usePagedList`；表单弹窗与侧边面板用 `FormDialog`（react-hook-form 加 zod，提交中禁用、成功后关闭）。
- 表格 `rowKey` 使用稳定主键 `id`；新增、编辑、删除成功后经 `useInvalidate` 让对应查询重读，弹窗在重读完成后关闭。
- 危险操作用 `ConfirmAction` 二次确认；编码字段用 `GeneratedCodeInput`；树形数据用 `TreeSelect` / 树视图（WAI-ARIA 树形模式）；空状态用 `EmptyState`。
- 页面容器与标题用物料包的页面组件，标题为页面唯一的一级标题；不额外堆叠说明性卡片。
- 弹层（Dialog、Sheet、Popover 等 Radix 组件）必须有可访问名称（标题），可用键盘打开和关闭；全屏画布里的弹层用组件的 `container` 属性挂进全屏容器。
- 物料改动要同时更新 Storybook 故事（文档、交互、无障碍检查）与注册表条目（`packages/ui/registry.json`）。

## 请求规范

- 登录：整页跳网关 `GET /oauth2/authorization/keycloak`（Keycloak 授权码加 PKCE），前端没有登录页；退出：`POST /logout`。
- 当前用户资源接口：`GET /auth/current/resources`。
- 管理接口统一位于 `/auth/manage/**`。
- 分页查询使用 `GET /auth/manage/{resources}` 并传 `current`、`size` 查询参数；下拉、树形、授权回显等轻量选项查询使用 `GET /auth/manage/{resources}/options`。
- 更新使用 `PUT /auth/manage/{resources}/{id}`，删除使用 `DELETE /auth/manage/{resources}/{id}`；需要租户上下文的删除把 `tenantId` 放查询参数，不放请求体。
- 部门管理接口：`/auth/manage/depts`。
- 用户角色编辑必须先用 `GET /auth/manage/users/{userId}/roles` 回显历史角色，再用 `PUT /auth/manage/users/{userId}/roles` 按完整勾选结果同步。
- 角色资源编辑必须先用 `GET /auth/manage/roles/{roleId}/resources` 回显历史资源，再用 `PUT /auth/manage/roles/{roleId}/resources` 按完整勾选结果同步。
- 角色自定义数据范围编辑必须先用 `GET /auth/manage/roles/{roleId}/data-scope-depts` 回显历史部门，再用 `PUT /auth/manage/roles/{roleId}/data-scope-depts` 按完整勾选结果同步。
- 编码生成接口：`POST /auth/manage/codes`。
- 请求头由 `createHttpClient` 统一追加，应用不手写：

```text
X-Requested-With: XMLHttpRequest
X-XSRF-TOKEN: <XSRF-TOKEN Cookie>   # 写请求；会话在网关 Cookie 里，前端不带 Authorization
X-Tenant-Id: <选中的租户>
X-Release-Version / X-Traffic-Lane  # 灰度头，取本应用构建时的 VITE_* 变量
```

- 后端统一响应 `success=false` 时抛错并展示 `errorMessage` 或 `msg`（原样显示，不改写）；需要页面自己处理的请求传 `skipErrorHandler`。
- 任何请求 401 都整页跳网关登录入口；403 显示后端给的说明（如 CSRF 令牌失效、无权访问所请求的租户）。
- 页面与接口同源：开发与预览时 Vite 代理把业务前缀与 `/oauth2`、`/login/oauth2`、`/logout` 转给网关（保留 Host）；当前用户中心 service path 为 `/auth/**`。
- 写操作结果不确定（超时、断网）时只读查回，不自动重发；需要幂等的写操作带不透明请求号（见 README「功能说明」）。

## 权限规范

- 新增页面或管理入口时同步核对子应用菜单（`MenuEntry.access`）、路由守卫（`RequireAccess`）、`access.ts` 标志、后端菜单资源、接口权限与目标角色授权；页面可见不代表服务端已授权。
- 后端权限码来自 `permissions`，前端菜单资源来自 `frontendResources`。
- 后端管理权限码为 `user:auth:manage`；前端菜单资源码：

```text
menu:tenant
menu:dept
menu:user
menu:role
menu:resource
```

- `packages/auth/src/access.ts` 只做布尔判断，不发请求、不写存储、不产生副作用。
- 子应用菜单的 `access` 与 `RequireAccess` 的 `flag` 必须用 `access.ts` 里定义的标志名。

## 会话规范

- 登录态只在网关会话（Cookie）里，前端不存访问令牌；本地只存选中的租户（`admin_web_selected_tenant_id`）与个人界面偏好（语言、主题）。
- `@admin-web/auth` 的会话启动读 `/auth/current/resources` 判断是否已登录并取权限资源；选中的租户不可用（403）时清掉选择重读一次；网关在但资源读不到时进入恢复页。
- 切换租户清空共享的查询缓存，重新读取会话。
- 子应用单独运行时没有网关会话只提示先在主应用登录，不跳转。

## 表单规范

- 新增必填字段必须与后端 `Save` 校验组一致，用 zod 模式表达，错误文案走 i18n。
- 编辑必传 `id` 和 `version`，保证后端乐观锁生效。
- 租户内资源必须提交 `tenantId`。
- 用户编辑不展示密码字段，新增用户必须填写密码。
- 编码字段创建后默认不可编辑，避免破坏唯一约束和授权关系。
- 所有需要输入业务编码的表单必须提供“生成”按钮，按钮只能调用后端 `POST /auth/manage/codes`，禁止前端自行拼接或随机生成编码。
- 编码生成请求必须传 `target`，租户用 `TENANT`，部门用 `DEPT`，角色用 `ROLE`，权限资源用 `RESOURCE`；资源编码还要传 `resourceCategory`，便于后端生成 `menu:` 或 `api:` 命名空间。

## 资源树规范

- 权限资源以 `parentId` 组织树，不在前端新增其它父子字段。
- 权限资源列表是树形表格，角色绑定资源用树形多选。
- 编辑父级时必须排除自身及子孙节点，避免形成循环树。
- 部门以 `parentId` 组织树；部门列表是树形表格，用户所属部门和角色自定义数据范围都用部门树。

## 多语言规范

- 每个应用一个命名空间（`shell`、`system`、`message`、`ai`、`rag`），共用词放 `common`；文案在 `packages/i18n/locales/zh-CN` 与 `en-US`，两份键必须一致（测试核对）。
- 应用源码不写死中日韩文字（ESLint `admin-web/no-hardcoded-cjk`）；测试与故事文件除外。
- 后端返回的提示原样显示，不翻译、不改写。

## 样式规范

- 用 Tailwind 工具类与主题变量（`bg-background`、`text-muted-foreground`、`--primary` 等），不写死颜色值；新令牌改 `packages/theme/tokens` 后重新生成。
- 子应用的类名都带子应用前缀（Tailwind 的 `prefix`，如 `ai:flex`、`ai:sm:w-72`，写在子应用的 `src/styles.css`）：各应用单独构建的工具类会先后进同一个页面，不加前缀时同名的类会互相覆盖、打乱变体的先后。ESLint 规则 `admin-web/tailwind-prefix` 检查 `className`、`*ClassName`、`cn()` 里的类名，`pnpm lint:repo --fix` 可自动补前缀；主应用与物料包（`packages/ui`）不加前缀。任意值里引用主题用设计令牌（`var(--border)`），不用 Tailwind 内部的 `--color-*`。
- 改物料组件的外观在物料包里改（带故事），不在应用里覆盖物料的内部类名。
- 浅色与暗色都要看；不使用大面积单色渐变、装饰性空卡片、嵌套卡片。
- 表格、表单、弹窗宽度要稳定，避免内容变化导致布局跳动。

## 交付规范

- 每次功能变更后至少执行（与 CI 同一套门禁）：

```bash
pnpm check
pnpm test:e2e
bash scripts/check-secrets.sh
```

- 改子应用接入、共享单例或构建配置时加跑 `pnpm test:deploy`；改生成器模板时加跑 `pnpm test:generator`。
- 前端测试分层以 `TESTING_SPEC.md` 为准；单元、组件和页面测试不访问真实后端，真实网关一组只连接 test 环境。
- 修改登录、路由、权限、请求拦截后必须本地打开页面验证。
- 提交前检查：

```bash
git status --short --ignored
```

- 不允许提交：`node_modules/`、`dist/`、`.turbo/`、`coverage/`、`storybook-static/`、`e2e-out/`、`.vitest/`、`packages/ui/public/r/`、`.env.local`、`.idea/`、`.run/`、`*.iml`、`.DS_Store`、`*.log`。
