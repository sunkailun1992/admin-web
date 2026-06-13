# AI 代码编写指导规范

本文档用于约束 AI 在本项目中生成、修改和审查前端代码。项目基线为 Ant Design Pro、Umi Max、React、TypeScript、Ant Design 5 和 ProComponents。

## 基本原则

- 先读后端接口、DTO、VO、权限码和现有前端结构，再写代码。
- 先读 `AI_AUTOMATION_WORKFLOW.md`，按需求说明、验收标准、开发手册、测试说明和交付说明组织自动化开发。
- 先读 `AI_ENGINEERING_GUARDRAILS.md`，按风险分级、Definition of Done、测试门禁、安全门禁和交付说明约束 AI 生成代码。
- 先读 `AI_DIRECTORY_STRUCTURE_GUIDE.md`，按 Umi Max、React、TypeScript 和 Ant Design Pro 项目结构管理目录。
- 先读 `AI_DESIGN_PATTERN_GUIDE.md`，按 React、TypeScript、Umi 和 Ant Design Pro 项目结构选择设计模式。
- 不凭空新增接口字段、路由、权限码或状态值；字段必须来自后端代码、接口文档或明确需求。
- 优先使用 Ant Design Pro 官方范式：`PageContainer`、`ProTable`、`ModalForm`、`ProForm*`、`StatisticCard`。
- 业务页面保持 CRUD 闭环：查询、新增、编辑、删除、错误提示、刷新表格。
- 所有远程请求集中放在 `src/services`，页面不直接拼 axios/fetch。
- 所有登录态、Token、请求拦截、错误处理集中放在运行时配置和工具函数中。
- 不提交本地文件、构建产物、依赖目录、IDE 配置和缓存文件。
- 不在 README、AI 规范、配置、脚本、测试、示例和前端代码中写入个人电脑绝对路径、本机下载目录、本机 Node/JDK 路径或本机仓库完整路径。
- 目录关系使用 `../user`、`../gateway`、`../message`、`../utils` 这类相对路径；可变安装位置、缓存目录、导出目录或临时目录使用环境变量、前端配置、`~` 用户目录或 `<PLACEHOLDER>` 占位符。
- 提交前必须使用 `rg` 搜索本机用户名、用户目录、仓库根目录和系统盘路径关键字，检查是否残留本机路径。

## 多智能体协作规则

- 可以使用多个子智能体并行协作，但子智能体默认只能执行需求分析和项目学习，不直接修改代码。
- 大项目学习时，可以让多个 explorer 分别阅读前端页面、后端接口、权限资源、Nacos/Gateway 配置和构建脚本；这类读多写少任务冲突小，收益高。
- 问题排查时，可以让多个 explorer 分别检查前端请求、后端接口、配置权限、数据库和日志；主智能体必须最后汇总证据并判断根因。
- 代码 Review 可以按安全风险、逻辑 bug、测试缺口、性能问题和可维护性拆分给多个 reviewer；结论必须由主智能体统一收口。
- 测试回归和日志分析可以并行：一个 agent 跑 `pnpm build`，一个 agent 分析失败日志，一个 agent 查最近改动；最终修复仍由主智能体或一个明确 worker 收口。
- 大功能可以拆给多个 worker 独立实现，但必须先划清写入边界，例如 worker A 只改前端页面、worker B 只改后端 API、worker C 只补测试。
- 如果多个 worker 需要修改同一个核心页面、同一个 service 文件、同一个路由文件或同一份权限判断，不允许并行写入，必须改为主智能体串行处理。
- 子智能体输出应包含读取范围、关键发现、风险点和建议，不应直接给出未经主智能体验证的最终结论。

## 安全编码规则

安全细则单独维护在 `SECURITY_CODING_SPEC.md`。新增或修改页面、按钮、请求服务、登录态、上传下载、富文本、脱敏、批量操作时，必须先阅读该文件并按检查清单验证。

## 注释要求

- AI 新增或修改 TypeScript、TSX、JavaScript、CSS、配置、脚本、测试和示例等编程内容时，必须遵守 `AI_COMMENT_STYLE_GUIDE.md`。
- 修改注释前先识别文件类型和框架上下文；规范未覆盖时，先查官方或主流规范并补充到注释规范文件。
- 优先让代码自解释，能用组件名、函数名、类型、常量和拆分后的状态表达的意图，不用注释补救。
- 注释解释长期维护需要知道的交互目的、权限边界、接口契约、状态流转和错误处理。
- 禁止逐行翻译式注释，禁止用注释保留废弃组件、旧 JSX、临时调试代码或整块旧实现。
- 注释必须保持缩进、对齐、换行和段落美观一致；不能为了补说明把页面、配置或样式文件弄乱。

## 设计模式要求

- AI 新增或重构 TypeScript、TSX、service、Hook、权限和状态代码前，必须遵守 `AI_DESIGN_PATTERN_GUIDE.md`。
- 页面复用优先使用组件组合和 ProComponents 官方范式。
- 远程接口统一通过 `src/services` 做 service adapter，页面不直接拼请求。
- 跨页面状态优先使用 Umi initialState、access 和 request 运行时能力；简单局部状态不引入全局状态库。
- 固定状态、分类、权限码和 HTTP 方法优先放入 `src/constants` 映射，不写散落 `if/else`。
- 禁止照搬 Java 式抽象类、Service Locator 和过深继承。

## 目录规范

```text
src/
  app.ts                     # Umi 运行时配置、登录态、请求拦截
  access.ts                  # 前端权限判断
  constants/                 # 常量、枚举映射、存储 key
  components/                # 可复用业务组件
  pages/                     # 路由页面
  services/                  # API 请求与接口类型
  utils/                     # 纯工具函数
docs/
  ai-coding/
    README.md                       # AI 编码规范入口
    AI_CODING_GUIDE.md              # AI 编码规范
    AI_DIRECTORY_STRUCTURE_GUIDE.md # 目录管理规范
    AI_DESIGN_PATTERN_GUIDE.md      # AI 设计模式规范
    AI_ENGINEERING_GUARDRAILS.md    # AI 工程门禁规范
    SECURITY_CODING_SPEC.md         # 前端安全编码规范
```

页面目录按业务域组织：

```text
src/pages/System/Tenant
src/pages/System/User
src/pages/System/Role
src/pages/System/Resource
```

## TypeScript 规范

- 禁止使用 `any` 绕过业务类型；确需兼容第三方库时范围必须最小。
- 后端响应统一建模为 `API.ApiResponse<T>`。
- 分页响应统一建模为 `API.Page<T>`，页面层只消费 `records`、`total`、`current`、`size`。
- 表单入参使用后端 `*BO` 类型，查询入参使用后端 `*Query` 类型，表格行使用后端 `*VO` 类型。
- 可选字段用 `?`，不要用空字符串表达缺失值；提交前用 `cleanPayload` 去掉 `undefined`。

## Ant Design Pro 规范

- 列表页使用 `ProTable`，弹窗表单使用 `ModalForm`。
- 查询区字段与后端 `*Query` 保持一致。
- 表格 `rowKey` 必须使用稳定主键 `id`。
- 新增、编辑、删除成功后调用 `actionRef.current?.reload()`。
- 危险操作必须使用 `Popconfirm` 二次确认。
- 状态、分类、HTTP 方法等固定选项集中放在 `src/constants`。
- 页面标题使用 `PageContainer title`，不要额外堆叠说明性卡片。

## 请求规范

- 登录接口：`POST /auth/sessions`。
- 登录前租户下拉接口：`GET /auth/tenants`。
- 当前用户资源接口：`GET /auth/current/resources`。
- 管理接口统一位于 `/auth/manage/**`。
- 分页查询使用 `GET /auth/manage/{resources}` 并传 `current`、`size` 查询参数；下拉、树形、授权回显等轻量选项查询使用 `GET /auth/manage/{resources}/options`。
- 更新使用 `PUT /auth/manage/{resources}/{id}`，删除使用 `DELETE /auth/manage/{resources}/{id}`；需要租户上下文的删除把 `tenantId` 放查询参数，不放请求体。
- 部门管理接口：`/auth/manage/depts`。
- 用户角色编辑必须先用 `GET /auth/manage/users/{userId}/roles` 回显历史角色，再用 `PUT /auth/manage/users/{userId}/roles` 按完整勾选结果同步。
- 角色资源编辑必须先用 `GET /auth/manage/roles/{roleId}/resources` 回显历史资源，再用 `PUT /auth/manage/roles/{roleId}/resources` 按完整勾选结果同步。
- 角色自定义数据范围编辑必须先用 `GET /auth/manage/roles/{roleId}/data-scope-depts` 回显历史部门，再用 `PUT /auth/manage/roles/{roleId}/data-scope-depts` 按完整勾选结果同步。
- 编码生成接口：`POST /auth/manage/codes`。
- 请求头统一追加：

```text
Authorization: Bearer <token>
```

- 后端统一响应 `success=false` 时必须抛错并展示 `errorMessage` 或 `msg`。
- 401、403 必须清理本地登录态并跳转 `/login`。
- 前端通过 Umi request `baseURL` 直接请求网关 `http://localhost:8080`，user-center 模块前缀在 `src/services/auth/index.ts` 统一拼接，现有 service path 仍写 `/auth/**`，最终请求为 `/user/auth/**` 并由网关转发到 `user` 服务；不要直接请求 `user` 的 `http://localhost:7500`，也不要再为 `/auth` 单独配置 dev proxy。

## 权限规范

- 后端权限码来自 `permissions`，前端菜单资源来自 `frontendResources`。
- 后端管理权限码为 `user:auth:manage`。
- 前端菜单资源码：

```text
menu:tenant
menu:dept
menu:user
menu:role
menu:resource
```

- `access.ts` 只做布尔判断，不发请求、不写存储、不产生副作用。
- 路由中的 `access` 必须使用 `access.ts` 中定义的能力名。

## 登录态规范

- Token 存储 key：`admin_web_access_token`。
- 登录用户信息存储 key：`admin_web_login_info`。
- `getInitialState` 在存在 Token 时调用 `/auth/current/resources` 刷新权限资源。
- 页面跳转由 `layout.onPageChange` 统一兜底，未登录用户进入业务页必须跳转 `/login`。

## 表单规范

- 新增必填字段必须与后端 `Save` 校验组一致。
- 编辑必传 `id` 和 `version`，保证后端乐观锁生效。
- 租户内资源必须提交 `tenantId`。
- 用户编辑不展示密码字段，新增用户必须填写密码。
- 编码字段创建后默认不可编辑，避免破坏唯一约束和授权关系。
- 所有需要输入业务编码的表单必须提供“生成”按钮，按钮只能调用后端 `POST /auth/manage/codes`，禁止前端自行拼接或随机生成编码。
- 编码生成请求必须传 `target`，租户用 `TENANT`，部门用 `DEPT`，角色用 `ROLE`，权限资源用 `RESOURCE`；资源编码还要传 `resourceCategory`，便于后端生成 `menu:` 或 `api:` 命名空间。

## 资源树规范

- 权限资源以 `parentId` 组织树，不在前端新增其它父子字段。
- 权限资源列表使用树形 `ProTable`，角色绑定资源使用树形多选。
- 编辑资源父级时必须排除自身及子孙节点，避免形成循环树。
- 部门以 `parentId` 组织树；部门列表使用树形 `ProTable`，用户所属部门和角色自定义数据范围使用部门树。

## 样式规范

- 优先使用 ProComponents 和 Ant Design 默认样式。
- 只在页面需要明显布局差异时新增 `.less`。
- 不使用大面积单色渐变、装饰性空卡片、嵌套卡片。
- 表格、表单、弹窗宽度要稳定，避免内容变化导致布局跳动。

## 交付规范

- 每次功能变更后至少执行：

```bash
pnpm build
bash scripts/check-secrets.sh
```

- 修改登录、路由、权限、请求拦截后必须本地打开页面验证。
- 提交前检查：

```bash
git status --short --ignored
```

- 不允许提交：

```text
node_modules/
dist/
.turbopack/
src/.umi/
src/.umi-production/
.idea/
*.iml
.DS_Store
*.log
```
