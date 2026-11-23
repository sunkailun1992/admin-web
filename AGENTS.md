# AGENTS.md

本文件是 `admin-web` 项目的 AI 编码入口。AI 修改本项目代码前，必须先阅读本文件，再按修改前阅读顺序读取项目 README、AI 编程规范、工程门禁和安全规范。

## GitHub 分支与交付管理

- 长期分支只保留 `main`，禁止删除或 force push，不再创建 `test`、`preprod`。新任务先核对仓库、HEAD、dirty、worktree 并 fetch，从最新 origin/main 建独立短分支；同一任务可核对后复用。
- 功能分支承载完整功能及测试、文档、契约、migration 和精确依赖；正式候选在最新 main 上独立验证完整功能与跨仓配套。
- 本任务短分支完整合入各仓 main、main 推送并远端读回、完整包含关系确认后才清理；保护 `main`、未合入或仍有唯一提交、dirty 及其他 worktree 使用中的分支，不用强删绕过保护。
- Git、验证、CI、制品、部署和真实验收分别取证；GitHub 不继承公司自动部署 lane。已授权 commit/push/merge 按当前任务完成，tag/发布/部署不从分支名推定授权。
- 命名、集成、清理、版本与交付按 `docs/ai-coding/BRANCHING_SPEC.md` 和 `VERSIONING_SPEC.md`，不使用旧 main-only 或 personal/dev 流程。
- 维护者本人，以及维护者本机用维护者账号运行的 Claude / Codex 会话，可以直接合并到 `main`：合并前本机验证命令全过，合并后看 CI，红了马上修。推送后读回精确提交的 CI 结论。
- 云端会话（`CLAUDE_CODE_REMOTE=true`，或会话里没有本机配置）只推会话分支，由维护者或本机会话合并。其他人的代码走 PR：CI 全绿、维护者审核批准、评审对话解决后再合并。代理不修改 ruleset 与仓库权限，除非用户当场明确要求。
- 测试必须稳定可重复，按 `docs/ai-coding/TESTING_SPEC.md`「测试稳定性」：不依赖时序、连接复用或执行顺序；偶发失败按缺陷处理，不用重试、跳过或删除测试掩盖。

## 项目定位

- 项目名称：`admin-web`
- 项目类型：用户中心后台管理前端，也是可裂变的基础框架（各公司以后从这里裂变出自己的管理端），微前端、物料、主题、插件前期拆好
- 技术栈（1.2.5 起）：pnpm 工作区加 Turborepo 单仓；Vite 8、React 19、React Router 8、TypeScript 6；Module Federation 2 微前端（主应用 `shell`，子应用 `system`、`message`、`ai`、`rag`）；shadcn/ui（Radix UI）与 Tailwind CSS 4 物料包，Storybook 10，shadcn 注册表；DTCG 设计令牌经 Style Dictionary 生成主题；TanStack Query、TanStack Table、react-hook-form 与 zod、axios；i18next
- 工具链：Node 26、pnpm 12.21.0、ESLint 10 扁平配置与 Prettier 3、Vitest（jsdom 与浏览器模式）与 Testing Library、MSW、Playwright（固定数据与真实网关两组）、husky 与 lint-staged
- 选型口径：只看国际主流（GitHub 上多个同类主流项目的多数做法、官方文档、标准与论文），依据记在维护者的第6阶段设计文档（国际主流重写设计）里
- 网关项目：同级仓库 `../gateway`；用户服务：同级仓库 `../user`（直连 `http://localhost:7500`，前端不直连）
- 网关地址：开发与预览代理的目标由各应用 `.env.*` 的 `ADMIN_WEB_GATEWAY_URL` 决定（本地 `http://localhost:7100`）；页面与接口同源，代码里不写环境地址
- 请求方式：同源加 Vite 代理（`packages/config-vite/src/proxy.ts`），网关是 BFF：登录、会话与令牌都在网关，前端不存不发访问令牌

## 项目职责

本项目负责：

- 登录（跳网关的 Keycloak 登录入口，前端只有登录失败页）与退出
- 租户、部门、用户、角色、权限资源管理，以及用户角色、角色资源、角色数据范围绑定（子应用 `system`）
- 消息发送与页头消息铃铛（子应用 `message`）
- AI 模型路由与统一配置的模型与能力、文件存储（子应用 `ai`）
- RAG 知识文档与知识图谱（子应用 `rag`）

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
10. `docs/ai-coding/ENVIRONMENT_CONFIG_SPEC.md`
11. `docs/ai-coding/VERSIONING_SPEC.md`
12. `docs/ai-coding/SECURITY_CODING_SPEC.md`
13. `docs/ai-coding/TESTING_SPEC.md`
14. 要改的应用：`apps/<应用>/src/routes.tsx`（子应用的路由与菜单）或 `apps/shell/src`（主应用），以及它的 `src/services`
15. 涉及共享能力时：`packages/auth/src/access.ts`、`packages/auth/src/types.ts`、`packages/api/src/client.ts`、`packages/config-vite/src`

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
src/main/resources/db/migration
```

## 多智能体协作规则

- 可按独立写入边界分配 worker；未获当前任务授权不修改其他 worker 或用户文件，主智能体统一收口。
- AI 开始功能开发前必须按 `docs/ai-coding/AI_AUTOMATION_WORKFLOW.md` 先整理需求说明、验收标准和开发手册；小改动可以简化输出，但检查项不能跳过。
- AI 完成功能后必须按 `docs/ai-coding/AI_ENGINEERING_GUARDRAILS.md` 做风险分级、Definition of Done、测试证据、安全检查、风险和回滚说明。
- AI 新增、移动或删除目录前必须按 `docs/ai-coding/AI_DIRECTORY_STRUCTURE_GUIDE.md` 判断应用与共享包的边界。
- 项目学习可以按子应用、共享包、后端接口、权限资源、Gateway/Nacos 配置和构建脚本拆分 explorer。
- 问题排查可以按前端请求、后端 Controller、配置权限、数据库日志和最近改动拆分 explorer，最终根因必须由主智能体判断。
- 代码 Review 可以按安全风险、逻辑缺陷、测试缺口、性能问题和可维护性拆分 reviewer，最终结论必须由主智能体汇总。
- 测试回归可以让一个 agent 跑测试、一个 agent 分析日志、一个 agent 检查最近 diff，但最终修复必须由主智能体或一个明确 worker 收口。
- 只有写入边界清楚时才允许并行实现：不同子应用（`apps/*`）天然是独立边界；同一个共享包、子应用接入契约、权限规则、根配置或 CI 不允许并行写入，必须由主智能体串行处理。
- 前端仓库不设计、不生成、不维护后端业务表、数据库字段或 DDL；涉及新增表结构时必须回到对应 Java 后端项目，按其 AI 表设计规范处理。后端各服务的表结构（含 Seata AT 的 `undo_log`）只由该服务自己的 Flyway 迁移管理，新库保持空库，由首次启动时的 Flyway 建表，不手工执行任何公共脚本。

## 安全规则

安全细则维护在 `docs/ai-coding/SECURITY_CODING_SPEC.md`。修改页面、按钮、请求客户端、会话、路由守卫、上传下载、富文本、脱敏和批量操作前，必须先阅读安全规范。

## 注释规则

- 注释细则以 `docs/ai-coding/AI_COMMENT_STYLE_GUIDE.md` 为准。
- AI 新增或修改 TypeScript、TSX、配置、脚本、测试和示例前，必须先判断文件类型和上下文。
- 优先让代码自解释，能用组件名、函数名、类型、常量和拆分后的状态表达的意图，不用注释补救。
- 禁止逐行翻译式注释，禁止用注释长期保留废弃组件、旧 JSX、临时调试代码或整块旧实现。
- 注释必须保持缩进、对齐、换行和段落美观一致，不得把页面、配置或样式文件弄得杂乱。

## 设计模式规则

- 设计模式细则以 `docs/ai-coding/AI_DESIGN_PATTERN_GUIDE.md` 为准。
- 升级、选型和架构设计先查证主流做法：对照 GitHub 上多个同类主流项目（以多数为准），并查官方文档、RFC 与标准、权威指南和相关论文；不为了缩小改动范围采用偷懒的写法。
- React/TypeScript 代码优先使用组件组合、Custom Hook、服务适配层、Context 和状态映射，不照搬 Java 后端继承结构。
- 新增页面前先判断能否复用 `@admin-web/ui` 的物料与业务组件、现有 service 和常量映射；物料缺能力时先加进物料包（带故事与测试），不在应用里另起一套。
- 前端模式不能替代后端鉴权、租户隔离、字段级授权或数据权限。

## 路径与本机环境规则

- AI 新增或修改 README、AGENTS、配置、脚本、测试、示例和前端代码时，禁止写入个人电脑绝对路径、本机下载目录、本机 Node/JDK 路径或本机仓库完整路径。
- 需要描述同级仓库时，使用 `../user`、`../gateway`、`../message`、`../utils` 这类相对路径，不使用开发者机器上的完整目录。
- 需要描述可变安装目录、缓存目录、上传目录、导出目录或临时目录时，使用环境变量、前端配置、`~` 用户目录或 `<PLACEHOLDER>` 占位符。
- 本地私有路径只能放到未提交的本机配置、IDE 运行配置或用户级工具配置中，不得进入 Git 仓库。
- 提交前必须使用 `rg` 搜索本机用户名、用户目录、仓库根目录和系统盘路径关键字，检查是否残留本机路径。

## 接口契约

- 登录：浏览器整页跳 `GET /oauth2/authorization/keycloak`（网关，授权码加 PKCE）
- 退出：`POST /logout`（网关，XHR 回 202 与 Keycloak 注销地址，前端整页导航过去）
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
- 消息、AI、RAG 接口见 `README.md`「业务范围」

前端请求与页面同源，开发与预览时 Vite 代理转给网关；service 的 `/auth/**` 直接走同路径网关，不追加 `/user`，不直连后端服务。

认证靠网关会话 Cookie（`__Host-SESSION`），每个应用经 `@admin-web/api` 的 `createHttpClient` 统一处理：

```text
不带 Authorization（令牌只在网关会话里）
X-Requested-With: XMLHttpRequest    # 未登录时网关回 401 JSON
X-XSRF-TOKEN: <XSRF-TOKEN Cookie>   # 写请求
X-Tenant-Id: <选中的租户>            # 能否访问由 user 核对
X-Release-Version / X-Traffic-Lane  # 灰度头，取本应用构建时的 VITE_* 变量
```

任何请求 401 都整页跳网关登录入口；本地存储只放选中的租户与个人界面偏好（语言、主题），不放令牌。

## 子应用接入契约

- 子应用经 Module Federation 暴露 `./routes`，默认导出 `RemoteRoutes`（`packages/auth/src/types.ts`）：`routes`（页面懒加载）与 `menu`（路径、`labelKey`、`access`、分组）。
- 主应用按运行时配置 `apps/shell/apps.<mode>.json` 加载子应用；改子应用地址或加子应用不重新构建主应用。
- 子应用之间不互相引用源码，只经 Module Federation 暴露的入口或共享包往来；共享包只从入口引用（ESLint 规则拦截）。
- 共享单例的清单与版本只在 `packages/config-vite/src/shared.ts` 与 pnpm catalog 维护。

## 权限契约

后台管理页所需后端权限：

```text
user:auth:manage
```

前端资源编码：

```text
menu:tenant
menu:dept
menu:user
menu:role
menu:resource
```

RAG 与统一配置的权限见 `README.md`「权限模型」。权限判断统一维护在 `packages/auth/src/access.ts`，路由用 `RequireAccess`，菜单用 `MenuEntry.access`。

## 编码约束

- 每个应用的接口只写在自己的 `src/services`，类型写在相邻的 `types.ts`；请求客户端只用本应用的 `src/http.ts`（`createHttpClient`），不另建 axios 实例。
- 跨应用共用的接口类型与会话类型放共享包（`@admin-web/auth`、`@admin-web/api`），不复制。
- 界面优先用 `@admin-web/ui` 的物料与业务组件：数据表用 `DataTable`，表单弹窗与侧边面板用 `FormDialog`，确认操作用 `ConfirmAction`，编码输入用 `GeneratedCodeInput`，树形选择用 `TreeSelect`。
- 界面文案一律走 i18n 键（`@admin-web/i18n` 的命名空间），不在应用源码里写死中日韩文字（ESLint 规则拦截）；后端返回的提示原样显示。
- 样式用 Tailwind 工具类与主题变量（`--primary`、`--background` 等），不写死颜色；需要新令牌时改 `packages/theme/tokens`。子应用的类名都带子应用前缀（如 `rag:flex`，写在它的 `src/styles.css`，ESLint 规则 `admin-web/tailwind-prefix` 拦截、可自动修复），任意值里引用主题用设计令牌（`var(--border)`），不用 Tailwind 内部的 `--color-*`。
- 不得凭空新增后端字段，必须匹配后端 `BO`、`Query` 和 `VO`。
- 展示租户时使用租户名称，`tenantId` 只作为接口内部字段使用。
- 业务编码必须调用后端编码生成接口，不允许浏览器随机生成业务编码。
- 更新接口必须携带 `version`，保证后端 MyBatis-Plus 乐观锁生效。
- 测试分层按 `docs/ai-coding/TESTING_SPEC.md` 执行；普通单元、组件和页面测试不访问真实后端，真实网关一组只连接 test 环境。
- 功能变更后执行 `pnpm check`、`pnpm test:e2e` 和 `bash scripts/check-secrets.sh`；改登录、会话、路由、请求拦截或核心管理页时，再按 `TESTING_SPEC.md` 跑真实网关一组；改子应用接入、共享单例或构建配置时，再跑 `pnpm test:deploy`。

## 禁止提交

- 禁止 AI 触碰真实密钥/凭证、token 或默认账号口令（疑似密钥只能告警，由项目负责人处理）；配置结构性调整（网关地址、后端地址、环境/构建配置的结构与引用）允许 AI 自主完成，但必须保值不改值，不得擅自变更生产环境的实际配置值。

```text
node_modules/
dist/
.turbo/
coverage/
storybook-static/
e2e-out/
.vitest/
packages/ui/public/r/
.env.local
*.local
.idea/
.run/
*.iml
.DS_Store
*.log
```
