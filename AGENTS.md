# AGENTS.md

本文件是 `admin-web` 项目的 AI 编码入口。AI 修改本项目代码前，必须先阅读本文件，再按修改前阅读顺序读取项目 README、AI 编程规范、工程门禁和安全规范。

## 项目定位

- 项目名称：`admin-web`
- 项目类型：用户中心后台管理前端
- 技术栈：Ant Design Pro、Umi Max、React、TypeScript、Ant Design 5、ProComponents
- 包管理器：`pnpm`
- 网关项目：同级仓库 `../gateway`
- 用户服务项目：同级仓库 `../user`
- 网关本地地址：`http://localhost:8080`
- 用户服务直连地址：`http://localhost:7500`
- 请求方式：使用 Umi request 的 `baseURL` 直连网关，不使用 Umi dev proxy

## 项目职责

本项目负责管理 `user` 后端认证域能力：

- 登录
- 租户管理
- 用户管理
- 角色管理
- 权限资源管理
- 用户角色绑定
- 角色资源绑定

## 修改前阅读顺序

修改行为前必须先阅读：

1. `README.md`
2. `docs/ai-coding/README.md`
3. `docs/ai-coding/AI_CODING_GUIDE.md`
4. `docs/ai-coding/AI_DIRECTORY_STRUCTURE_GUIDE.md`
5. `docs/ai-coding/AI_COMMENT_STYLE_GUIDE.md`
6. `docs/ai-coding/AI_DESIGN_PATTERN_GUIDE.md`
7. `docs/ai-coding/AI_AUTOMATION_WORKFLOW.md`
8. `docs/ai-coding/AI_ENGINEERING_GUARDRAILS.md`
9. `docs/ai-coding/BRANCHING_SPEC.md`
10. `docs/ai-coding/VERSIONING_SPEC.md`
11. `docs/ai-coding/SECURITY_CODING_SPEC.md`
12. `.umirc.ts`
13. `src/app.ts`
14. `src/access.ts`
15. `src/services/auth/index.ts`
16. `src/services/auth/types.d.ts`

接口行为不明确时，必须阅读同级后端项目：

```text
../user
```

重点阅读后端文件：

```text
README.md
src/main/java/com/kellen/auth/controller
src/main/java/com/kellen/auth/entity/bo
src/main/java/com/kellen/auth/entity/query
src/main/java/com/kellen/auth/entity/vo
src/main/resources/db/auth-schema.sql
```

## 多智能体协作规则

- 可以使用多个子智能体，但默认只能用于需求分析和项目学习，不允许直接修改代码。
- AI 开始功能开发前必须按 `docs/ai-coding/AI_AUTOMATION_WORKFLOW.md` 先整理需求说明、验收标准和开发手册；小改动可以简化输出，但检查项不能跳过。
- AI 完成功能后必须按 `docs/ai-coding/AI_ENGINEERING_GUARDRAILS.md` 做风险分级、Definition of Done、测试证据、安全检查、风险和回滚说明。
- AI 新增、移动或删除目录前必须按 `docs/ai-coding/AI_DIRECTORY_STRUCTURE_GUIDE.md` 判断 Umi、React、TypeScript 和 Ant Design Pro 目录边界。
- 项目学习可以按前端页面、后端接口、权限资源、Gateway/Nacos 配置和构建脚本拆分 explorer。
- 问题排查可以按前端请求、后端 Controller、配置权限、数据库日志和最近改动拆分 explorer，最终根因必须由主智能体判断。
- 代码 Review 可以按安全风险、逻辑缺陷、测试缺口、性能问题和可维护性拆分 reviewer，最终结论必须由主智能体汇总。
- 测试回归可以让一个 agent 跑测试、一个 agent 分析日志、一个 agent 检查最近 diff，但最终修复必须由主智能体或一个明确 worker 收口。
- 只有写入边界清楚时才允许并行实现，例如一个 worker 只改前端页面、一个 worker 只改后端 API、一个 worker 只补测试。
- 如果多个 worker 需要修改同一个核心页面、service 文件、路由文件、权限逻辑、SQL 脚本或共享配置，不允许并行写入，必须由主智能体串行处理。

## 安全规则

安全细则维护在 `docs/ai-coding/SECURITY_CODING_SPEC.md`。修改页面、按钮、请求服务、登录态、上传下载、富文本、脱敏和批量操作前，必须先阅读安全规范。

## 注释规则

- 注释细则以 `docs/ai-coding/AI_COMMENT_STYLE_GUIDE.md` 为准。
- AI 新增或修改 TypeScript、TSX、配置、脚本、测试和示例前，必须先判断文件类型和上下文。
- 优先让代码自解释，能用组件名、函数名、类型、常量和拆分后的状态表达的意图，不用注释补救。
- 禁止逐行翻译式注释，禁止用注释长期保留废弃组件、旧 JSX、临时调试代码或整块旧实现。
- 注释必须保持缩进、对齐、换行和段落美观一致，不得把页面、配置或样式文件弄得杂乱。

## 设计模式规则

- 设计模式细则以 `docs/ai-coding/AI_DESIGN_PATTERN_GUIDE.md` 为准。
- React/TypeScript 代码优先使用组件组合、Custom Hook、service adapter、Context 和状态映射，不照搬 Java 后端继承结构。
- 新增页面前先判断是否能复用 ProComponents、现有 service 和常量映射；不要为了模式新增复杂状态库或全局事件。
- 前端模式不能替代后端鉴权、租户隔离、字段级授权或数据权限。

## 路径与本机环境规则

- AI 新增或修改 README、AGENTS、配置、脚本、测试、示例和前端代码时，禁止写入个人电脑绝对路径、本机下载目录、本机 Node/JDK 路径或本机仓库完整路径。
- 需要描述同级仓库时，使用 `../user`、`../gateway`、`../message`、`../utils` 这类相对路径，不使用开发者机器上的完整目录。
- 需要描述可变安装目录、缓存目录、上传目录、导出目录或临时目录时，使用环境变量、前端配置、`~` 用户目录或 `<PLACEHOLDER>` 占位符。
- 本地私有路径只能放到未提交的本机配置、IDE 运行配置或用户级工具配置中，不得进入 Git 仓库。
- 提交前必须使用 `rg` 搜索本机用户名、用户目录、仓库根目录和系统盘路径关键字，检查是否残留本机路径。

## 接口契约

- 登录：`POST /auth/sessions`
- 登录前租户列表：`GET /auth/tenants`
- 当前用户资源：`GET /auth/current/resources`
- 当前用户可切换租户：`GET /auth/current/tenants`
- 租户：`GET /auth/manage/tenants`、`GET /auth/manage/tenants/options`、`POST /auth/manage/tenants`、`PUT|DELETE /auth/manage/tenants/{id}`
- 用户：`GET /auth/manage/users`、`GET /auth/manage/users/options`、`POST /auth/manage/users`、`PUT|DELETE /auth/manage/users/{id}`
- 部门：`GET /auth/manage/depts`、`GET /auth/manage/depts/options`、`POST /auth/manage/depts`、`PUT|DELETE /auth/manage/depts/{id}`
- 角色：`GET /auth/manage/roles`、`GET /auth/manage/roles/options`、`POST /auth/manage/roles`、`PUT|DELETE /auth/manage/roles/{id}`
- 权限资源：`GET /auth/manage/resources`、`GET /auth/manage/resources/options`、`POST /auth/manage/resources`、`PUT|DELETE /auth/manage/resources/{id}`
- 用户角色：`GET|POST|PUT /auth/manage/users/{userId}/roles`
- 角色资源：`GET|POST|PUT /auth/manage/roles/{roleId}/resources`
- 角色数据范围部门：`GET|PUT /auth/manage/roles/{roleId}/data-scope-depts`
- 编码生成：`POST /auth/manage/codes`

前端使用 Umi request 的 `baseURL = http://localhost:8080`；用户中心接口在 `src/services/auth/index.ts` 内统一追加模块前缀，所以 `/auth/sessions` 最终会请求网关路径 `/user/auth/sessions`。网关负责把 `/user/**` 转发到 `user` 服务。

所有需要认证的请求必须携带：

```text
Authorization: Bearer <token>
```

## 权限契约

后台管理页所需后端权限：

```text
user:auth:manage
```

前端资源编码：

```text
menu:tenant
menu:user
menu:role
menu:resource
```

权限判断统一维护在 `src/access.ts`。

## 编码约束

- 请求服务必须集中在 `src/services/auth/index.ts`。
- API 类型必须集中在 `src/services/auth/types.d.ts`。
- 管理页面必须优先使用 ProComponents。
- 不得凭空新增后端字段，必须匹配后端 `BO`、`Query` 和 `VO`。
- 展示租户时使用租户名称，`tenantId` 只作为接口内部字段使用。
- 业务编码必须调用后端编码生成接口，不允许浏览器随机生成业务编码。
- 更新接口必须携带 `version`，保证后端 MyBatis-Plus 乐观锁生效。
- 功能变更后必须执行 `pnpm build` 和 `bash scripts/check-secrets.sh`。

## 禁止提交

- 禁止 AI 触碰真实密钥/凭证、token 或默认账号口令（疑似密钥只能告警，由项目负责人处理）；配置结构性调整（网关地址、后端地址、环境/构建配置的结构与引用）允许 AI 自主完成，但必须保值不改值，不得擅自变更生产环境的实际配置值。

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
