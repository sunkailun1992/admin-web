# RAG 工作台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成列表优先的知识文档管理和画布优先的图谱工作台，改善筛选、上传、切片、来源与视图控制。

**Architecture:** 保留 Umi/AntD/G6 及统一 service/auth 边界，拆出单页面局部抽屉与画布组件，纯模型处理本地筛选、cursor 缓存和视图适配。现有图谱 submission/poll 算法保持，文档请求补身份/KB 作用域门闩。

**Tech Stack:** React18、TypeScript、Ant Design5、ProComponents、Umi Max、G6 5.1.1、现有 Node 测试。

**Spec:** `docs/superpowers/specs/2026-11-10-rag-workbench-design.md`（主会话已审核通过）。

## Global Constraints

- 无新增依赖、中间件、API、DDL、权限码；不改 AI 页/servicesAI/routes/sharedaccess。
- 上传文件/KB 信息加提交按钮即确认，不叠额外确认弹窗；停用和重建保留确认。
- 检索仅明确提交，topK 为 1–20、默认 6；任何视图操作不 POST 构建或付费自动重跑。
- 本地筛选已载入文档，不假装 server 分页；cursor 不随机跳页。
- 身份或 KB 切换清理旧显示并拒绝旧响应；全文按 React 文本渲染。
- 版本本批从 1.0.5 升至 1.0.6 一次；本阶段只交 diff/tests，不 push，真实浏览器由根验收。

## Review Focus

1. 旧身份/KB 的迟到响应不能进入新页面，Task1/2 测试门闩与取消。
2. 不可用检索不能显示“无资料”，Task1/2 测试 disabled/unavailable/empty 状态。
3. cursor 重复/切换文档/失败保留前页，Task3 测试缓存状态和过期响应。
4. 全屏/缩放/节点选择不能重建画布或重复 POST，Task4/5 测试控制器销毁和只读动作。
5. 超长/恶意来源和未知状态正常换行/转义，Task2/3/5 测试真实组件文本安全。

## Task1：文档模型、请求作用域与 service

Files：新增`src/constants/rag.ts`、`src/pages/Rag/Document/documentModel.ts`、`tests/unit/rag-document-model.test.mjs`；修改`src/services/rag/index.ts`与`tests/unit/rag-service-routing.test.mjs`。

- [x] 写 RED：多条件 search/status/type 筛选、按 ingestedAt 排序不修改原数组；服务不可用与空命中区分；新 scope 使旧 gate 失效；list/upload/retrieve 的 AbortSignal 透传。
- [x] 实现`filterDocuments(documents, filters)`、`retrievalState(value)`与`createDocumentRequestGate()`；复用现有 graph gate 语义但放文档局部模型，不改图谱算法。
- [x] service 补可选 signal，原调用参数兼容；跑相关 Node 测试至 GREEN。

## Task2：文档工作台与上传/检索抽屉

Files：修改`Document/index.tsx/index.less`；新增`UploadDocumentDrawer.tsx`、`RetrievalDrawer.tsx`、`RetrievalSourceDrawer.tsx`。

- [x] 用 ProTable 实现文档主列表、KB/文本/状态/格式筛选、时间排序、清空与刷新；行标题开切片，校验/停用保留明确动作。
- [x] 上传复用现有校验器，单文件 20MB；文件+KB+提交即确认；不显示虚构进度，结果区分向量与图谱；身份变更中止等待并忽略旧响应。
- [x] 检索抽屉有 KB/query/topK，只有提交调用；结果按真实状态显示，命中来源打开安全纯文本抽屉和文档切片。
- [x] 增加实际展示组件的文本/无权限/空状态测试；复用现有 Node+React server render，不增加测试依赖。

## Task3：切片分页与阅读

Files：修改`DocumentChunksDrawer.tsx`；新增局部`chunkPagination.ts`及`tests/unit/rag-chunk-pagination.test.mjs`。

- [x] 写 RED：下一 cursor 读取、缓存上一页、重复 cursor 拒绝、失败保留当前页、reset 后旧请求不生效。
- [x] 实现纯缓存状态辅助，抽屉目录/内容分区、上一页/下一页（默认 20）、来源/章节与折叠元数据；窄屏上下布局。
- [x] 跑分页/来源 XSS/权限测试；不新增按 chunkId 读取或原文件下载假接口。

## Task4：独立 GraphCanvas 与视图控制（根分派 fleet 并行）

Files：从`Graph/index.tsx`抽出`GraphCanvas.tsx`，新增`graphViewport.ts`及`tests/unit/rag-graph-viewport.test.mjs`，修改专属 Less。

- [x] 写 RED：zoom ratio/fit/focus 只调用正确 G6 API；resize 忽略零尺寸；dispose 后动作无效；缩放限制与没有选中节点兜底。
- [x] 保持 data 和选中事件接口，实例 ref 持有 Graph；toolbar zoom/fit/focus/clear/fullscreen，ResizeObserver 与 fullscreenchange 按生命周期清理。
- [x] 节点选择仅设置状态/回调，不更换 Graph 实例。全屏包含画布与控制，来源抽屉兼容全屏展示/退出。
- [x] 跑视图适配器和现有 graph 模型/来源/submission 测试。

## Task5：图谱工作台呈现（根分派 fleet 并行）

Files：修改`Graph/index.tsx/index.less`，必要时`GraphSources.tsx`（保留来源白名单/权限）。

- [x] 压缩顶部说明与构建状态、画布成为主体；保留 KB/query/type/limit 与 Neo4j 适配；区分服务端搜索和当前结果定位。
- [x] 详情面板展示节点/边、来源及当前返回的相邻项；不假装加载全库关系；图例/数量/截断提示靠近画布。
- [x] 验证原 pending submission、scope、poll 与重新构建确认完整保留，视图按钮不会调用 sync。

## Task6：整体验证与交根

- [x] freshfetch 再核远端版本/refs；package 版本仅改 1.0.6。pnpm9 锁文件无项目版本字段，依赖未变，不制造 lockfile 差异。
- [x] 运行`pnpm test:services`（92/92）、`pnpm exec tsc --noEmit`、`pnpm build:dev`、`bash scripts/check-secrets.sh`、diff/私有路径扫描，全部通过；格式仅处理本轮文件。
- [x] 更新 README 行为说明、计划勾选和未验证项；交根完整 source diff/tests。
- [ ] 根真实浏览器检查 1280/768/390、权限/401/403/切租户及关键交互；当前尚未以源码检查替代此项。
- [x] 本阶段未 push、未自动上传/检索/重建模型；未把静态构建或替身测试当真实体验验收。

本计划已按通过的 spec 逐项自检；执行方法由根明确为本会话实施，按根指令继续，无额外审批或执行方式提问。

## Task7：真实浏览器发现的账户菜单入口修复

主会话在真实浏览器复现账户菜单无法通过点击展开，现有入口为不可聚焦的 `span` 与默认 hover Dropdown。主会话授权在同批 1.0.6 仅修入口，不改认证和菜单动作。

- [x] 实际渲染回归先 RED：捕捉原生按钮、命名与 click 合同缺失；并覆盖无身份隐藏、撤销成功和失败后的原退出清理行为。
- [x] 入口改为 `type="button"`，补 `aria-label`、`aria-haspopup`、同步展开状态与原生焦点样式；声明 click，沿用原 settings/logout 动作。
- [x] 重跑全量测试 96/96（0 skipped）、类型、构建和安全检查通过，交根审核；仍未 commit/push。
- [x] 根重启开发服务、禁缓存并在同 Chrome 的新标签页实际点击，菜单显示账户设置/退出，上传抽屉可打开关闭；没有再修改组件事件。
- [ ] 根继续键盘与完整 RAG 交互验收；不以结构回归或单项点击通过替代全部浏览器验收。

### 本轮运行环境取证与验证顺序

首次入口修复后的旧页面仍整页不可交互，图谱全屏等按钮也无响应，开发日志出现批量 `SyntaxError: Unexpected token '<'`，页面同时引用 `.umi` 与 `.umi-production` 资源。已装 Umi 4.6.56 的 utoo bundler 源码显示 dev 与 build 都使用默认 `dist` 输出，dev 从该目录读取 `stats.json`，且默认清理输出；本轮构建在常驻 dev 期间运行，存在明确产物碰撞。临时生成目录本身仍是分开的，不能把现象归为同目录生成。

根严格确认自有进程后重启开发服务并禁用缓存，未出现新解析错误；旧标签页仍残留不可交互状态，同 Chrome 新标签页的账户菜单及上传抽屉交互恢复。该结果支持本轮资源混用及旧页面残留的运行问题，原生按钮补齐独立保留为点击和可访问性合同，不宣称其单独修复整页问题。

后续按“停止本 checkout dev → 测试/构建完成 → 重启 dev → 禁缓存或新标签页 → 实际点击验收”串行执行。本轮不再为仅文档收口重跑构建，也未修改 Umi 配置或给 Dropdown 叠加 onClick。

## Task8：AI 模型路由工作台

范围仅 Ai/Model、AI service options、access 严格写权限和独立 AI 测试/设计；Graph/Document/Layout 冻结在其他负责者边界内，保持版本 1.0.6。

- [x] RED：严格双权限；没有 supportedProviders 不猜选项；当前/非支持项禁止写；确认前无 PUT；不确定写只 GET；失败只读重试；换身份/卸载忽略迟到请求。
- [x] 实现纯请求控制器与真实 metadata 工作台，安全错误、支持卡片、全局影响确认与只读状态。
- [x] 真实 service 增加兼容可选 signal；接口路径/PUT body/鉴权保持。旧 service 缺 signal 在隔离 VM 重现，未临时改动运行 checkout。
- [x] AI 独立 14 项、整合全量 120 项全部通过（0 skipped），tsc、secret/diff/格式通过；本轮未 build，避免影响 dev。
- [ ] 主会话负责真实浏览器、停止 dev 后最终统一构建、main 与精确 SHA CI。用户已选 LiteLLM，部署接入仍以主会话真实回执为准。

## Task9：启动资源失败的安全会话恢复

主会话已批准最小修复并审核源码。实际 getInitialState VM 先捕获超时/403/500 清会话、畸形 200 构造旧管理员及恢复态仍渲染受保护组件的 RED；不将原取消请求归因于缺少认证头。

- [x] 按实际 401 及已存在 A0220/A0230 区分身份失效；其他失败/畸形 200 保留 token 但无 currentUser/缓存权限。
- [x] 新增 SessionRecovery，提供主动只读重试/退出；并发、卸载、会话变化拒绝旧响应；成功回工作台，退出撤销失败仍清本地。
- [x] 按已装 Umi 类型与 Exception 设置 unAccessible，childrenRender 丢弃受保护 Outlet；无用户时不渲染受保护内容，恢复态不自动跳登录。
- [x] currentResources 仅补可选 signal/skipErrorHandler，原路径、认证拦截和权限规则保持；正常响应使用当前服务器权限/管理员分类。
- [x] 专项 12 项、整合 132 项全部通过（0 skipped），tsc、secret/diff 通过；生产源码与测试已冻结，不 build/push。
- [ ] 主会话严格确认自有 dev 后停止、单次构建、重启并在新标签页做真实验收，随后统一 main/精确 SHA CI。
