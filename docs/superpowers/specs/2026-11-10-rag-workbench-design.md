# RAG 文档与图谱工作台设计

状态：主会话已审核 RAG、AI 路由及会话恢复改动，整合 132 项测试与类型检查通过，生产源码已冻结。此前构建仅覆盖较早的 RAG/账户改动，当前完整候选由主会话停止 dev 后统一构建并真实浏览器验收。基线 `0c5a5c196fb9af0a82decadd4522a8c0eaf13ab4`，沿用 Ant Design 5、ProComponents、Umi Max、G6 5.1.1，无新增运行依赖、中间件或付费自动重跑。

## 目标与现状

让用户在“找到文档—检查切片—试查检索—追溯图谱证据”之间方便移动。文档页首先服务查找和管理，上传与检索测试按需要展开；图谱页首先服务观察、定位和来源核对。

当前代码已经具备上传校验、文档版本/状态表、cursor 切片抽屉、检索结果、图谱搜索/类型/上限、节点/关系详情、来源证据、异步构建及未知提交查回。主要缺口是：上传和检索表单长期占据首屏，文档缺少搜索筛选；切片详情重复铺开很长；图谱缺少缩放/适配/全屏与当前节点定位，构建状态挤占画布；文档异步请求缺少图谱页已有的身份/作用域防旧响应机制。

本设计采用主会话指定的现有技术栈内改造。比较过的另一种方案是新增独立检索测试路由：空间更大，但增加菜单/权限入口与导航成本；本批使用抽屉保留当前上下文，不增路由或资源码。

## 固定源码参考及采用边界

参考原作者源码中的交互组织，独立实现，不复制整块组件或加入其依赖：

- [LightRAG DocumentManager](https://github.com/HKUDS/LightRAG/blob/638755767d2b1cedfb3f82b9362cfdfcf7a234fc/lightrag_webui/src/features/DocumentManager.tsx)：上传独立入口、状态筛选、分页、错误和空状态；本批保留单文件上传，不移植后台扫描/清空/解析管线。
- [LightRAG GraphViewer](https://github.com/HKUDS/LightRAG/blob/638755767d2b1cedfb3f82b9362cfdfcf7a234fc/lightrag_webui/src/features/GraphViewer.tsx)、[GraphSearch](https://github.com/HKUDS/LightRAG/blob/638755767d2b1cedfb3f82b9362cfdfcf7a234fc/lightrag_webui/src/components/graph/GraphSearch.tsx)、[PropertiesView](https://github.com/HKUDS/LightRAG/blob/638755767d2b1cedfb3f82b9362cfdfcf7a234fc/lightrag_webui/src/components/graph/PropertiesView.tsx)：画布控制、定位、图例与属性面板；本批不移植编辑/扩展/剪枝接口。
- [RAGFlow dataset table](https://github.com/infiniflow/ragflow/blob/b65b7ec3ece1a52ae71f1d967b9142fa90fa8383/web/src/pages/dataset/dataset/dataset-table.tsx)、[parsing status](https://github.com/infiniflow/ragflow/blob/b65b7ec3ece1a52ae71f1d967b9142fa90fa8383/web/src/pages/dataset/dataset/parsing-status-cell.tsx)、[testing result](https://github.com/infiniflow/ragflow/blob/b65b7ec3ece1a52ae71f1d967b9142fa90fa8383/web/src/pages/dataset/testing/testing-result.tsx)：表格为管理主体、状态与动作靠近文档、检索结果独立呈现；不增加当前后端没有的重命名/重新解析/下载。
- [Qdrant DataGridList](https://github.com/qdrant/qdrant-web-ui/blob/90a83dd67bb9e3f84cf62daed14a9489ae1e7fdd/src/components/Points/DataGridList.jsx)、[PointCard](https://github.com/qdrant/qdrant-web-ui/blob/90a83dd67bb9e3f84cf62daed14a9489ae1e7fdd/src/components/Points/PointCard.jsx)、[PointsFilter](https://github.com/qdrant/qdrant-web-ui/blob/90a83dd67bb9e3f84cf62daed14a9489ae1e7fdd/src/components/Points/PointsFilter/PointsFilter.jsx)：紧凑摘要与按需展开属性；不暴露原始向量、任意 payload/SQL 或 collection 管理。

以上内容通过官方 GitHub API 按固定 SHA 读回。参考交互不代表拥有原项目的所有后端能力。

## 视觉与布局

保持后台管理工具的阅读密度和现有中文语境。采用白底工作区、清晰边界、轻量分区；主蓝 `#1677ff`、正文 `#0f172a`、辅助文字 `#64748b`、页面底 `#f4f6f9`、边界 `#e2e8f0`、面板白 `#ffffff`，优先映射 AntD token。图谱类型色沿用已有语义映射。使用现有系统字体，不下载字体；页面标题 20、分区 16、正文 14、辅助 12；全部左对齐。状态同时有文字和颜色，主操作始终可定位，不堆装饰性统计卡。

文档页桌面结构：

```text
知识文档                                 [检索测试] [上传文档]
[知识库] [搜索标题/文件名/编码] [状态] [格式]     [刷新]
已载入 N 份 / 当前筛选 M 份
文档（标题+来源文件）| 知识库 | 版本 | 切片 | 状态 | 时间 | 操作
...稳定分页；行标题/查看切片；更多中提供校验和停用...
```

图谱页桌面结构：

```text
知识图谱                       构建状态摘要 [刷新] [重新构建]
[知识库] [搜索图谱] [节点类型] [数量上限] [查询]
┌──────────────────────────┬────────────────┐
│ 当前结果节点定位          │ 节点/关系详情   │
│                           │ 属性 | 来源证据 │
│        G6 关系画布        │ 关联（当前结果）│
│                           │ 查看文档切片    │
│ [缩小][比例][放大][适配][全屏]               │
└──────────────────────────┴────────────────┘
图例 / 已返回节点与关系数量 / 截断提示
```

窄屏将图谱详情转为可收起区域，操作条换行；表格横向滚动而不挤碎文档标题；抽屉宽度不超过视口，切片改为上下阅读。按钮具有 aria-label/Tooltip 与键盘焦点；全屏支持 Escape，动画尊重减少动态效果设置。

## 文档工作台

1. **列表优先**：替换首屏双表单为 ProTable/紧凑工具栏。知识库支持后端参数过滤；标题/来源文件/文档编码搜索、状态和格式筛选、时间排序只处理已载入列表，不伪造后端分页/全量总数。筛选变更重置当前页；清空条件可恢复。保留全部状态，中文标签准确区分处理中、可检索、旧版本、失败、已停用。
2. **上传抽屉**：复用现有 `uploadValidation` 与单文件 20MB 限制。文件区、知识库、标题、可选文档编码清晰分组，版本/去重规则折叠为帮助。上传有明确开始按钮和忙碌状态，不显示虚构百分比。校验成功、重复复用、图谱接收/失败分别展示；超时/断线不自动重发，提供只读刷新列表核对。上传属于写操作，提交前确认本次文件与目标 KB；停止浏览器等待不宣称后台任务已取消。
3. **切片预览**：沿用安全 cursor API。抽屉呈现切片目录/内容，来源位置和章节突出，扩展元信息按需展开；缓存已读页，支持上一页/下一页，不提供无后端依据的随机跳页。加载失败保留已读内容，重试同一只读页；切换文档或身份时中止旧请求并清空。
4. **检索测试抽屉**：仅用户提交才调用现有检索 API，不随输入自动请求。默认 topK 仍 6，允许 1–20 的已支持范围，不自动调阈值。结果显示切片/来源数量与评分，明确区分无命中、禁用和服务不可用；评分不包装为准确率。
5. **结果来源抽屉**：点击真实命中显示来源、完整命中内容、文档/切片 ID 与评分，可进入该文档的分页切片。接口没有原文件下载或按任意 chunkId 定位端点，按钮命名为“查看文档切片”，不声称已跳到某页原文件。
6. **权限与异常**：沿用现有路由/access 与统一 request；新增 AbortSignal 和身份/KB 请求门闩防迟到结果污染新上下文。停用仍须 Popconfirm，只在 ACTIVE 显示；成功后刷新，无权限和 API 失败均保留可理解反馈。

## 图谱工作台

1. 保留当前服务端 KB/query/nodeType/limit 查询与 Neo4j 视图适配；“搜索图谱”查询服务端，“定位当前结果节点”只搜索当前已加载节点并调用 G6 focusElement，二者明确命名。
2. 抽取独立 GraphCanvas 组件，提供放大、缩小、比例、适配、全屏、清除选择。使用已安装 G6 5.1.1 实际类型支持的 zoomBy/getZoom/fitView/focusElement/resize API。ResizeObserver 处理布局和全屏尺寸；卸载时 disconnect/destroy，不因普通详情切换重建画布或重置视口。
3. 节点/关系详情保留现有 GraphSources 来源证据，增加紧凑属性及当前返回结果中的相邻关系列表；点击相邻节点只定位已有节点。没有邻居扩展 API，不显示“加载全部关系”或把局部数量当全库度数。
4. 类型图例、返回数量和 truncated 提示靠近画布。构建进度压缩为状态条，可展开文档处理数、更新时间和固定错误码；不把 QUEUED/RUNNING 当成功，不把来源累计节点数与聚合图节点数混成一个数字。
5. 原`submissionModel`和有界轮询保持：身份/KB 绑定提交键、未知结果只查回、不会因视图操作重新 POST 构建。重新构建是明确确认操作，保留已发布图直到新构建成功，失败不自动重跑。刷新、搜索、缩放和全屏均不触发模型构建。

## 真实 API 能力映射

| 交互 | 已有 API/字段 | 边界 |
| --- | --- | --- |
| 文档列表/KB 过滤 | GET /api/rag/documents?knowledgeBase | 无服务端搜索、分页、排序；本批本地筛选已返回列表 |
| 上传/版本/校验/图谱状态 | POST /api/rag/documents multipart；document/idempotent/validation/graphBuild/graphStatus | 单文件；不展示未提供的阶段百分比；fileFingerprint 仅 12 位预览 |
| 切片分页 | GET /documents/{id}/chunks?limit&cursor | 1–100，默认 20；只有 nextCursor，无随机页码或全文下载 |
| 向量读回校验 | POST /documents/{id}/validation | 用户明确触发；与图谱发布结果分开 |
| 停用 | DELETE /documents/{id} | 逻辑停用，无恢复/物理删除接口 |
| 检索试查 | POST /api/rag/retrievals | query/collectionName/topK 等已有 DTO；显式调用，可能 embedding/rerank 计费 |
| 图查询 | GET /api/rag/graphs | KB/query/nodeType/viewMode/limit(20–500)；无图编辑、任意 Cypher 或邻居分页 |
| 构建与查回 | POST /graphs/sync + submission header；GET submissions/builds | 任务接收、运行、发布分开；未知提交不自动重发 |
| 画布视图控制 | G6 本地 API/浏览器 Fullscreen | 不产生模型/写入请求 |

权限保持 rag:document:manage、rag:retrieval:use、rag:graph:view/manage 及现有菜单资源；页面不拼 JWT/tenant，不新增 DDL、Nacos 或权限码。

## 文件边界与验证

预计主要修改 `src/pages/Rag/Document/{index.tsx,index.less,DocumentChunksDrawer.tsx}`，新增上传/检索/来源组件和纯文档筛选模型；`src/pages/Rag/Graph/{index.tsx,index.less}`抽取 GraphCanvas/视图工具，复用 GraphSources；`src/services/rag/index.ts`只补可选 AbortSignal，必要时微调类型；增加 Node 现有测试框架内的行为/服务回归，不新增 Vitest/Playwright 依赖。原 submissionModel 算法和真实 API 协议保持。

验收与回归：

- 纯模型：多条件筛选/排序、未知状态、空列表、筛选后分页重置；不会修改原始数组或发送假查询字段。
- 服务：现有路径、multipart、query、AbortSignal、身份变化下旧结果忽略；检索只在提交时发一次，视图控制不 POST 构建。
- 切片：cursor 下一页、缓存上一页、失败重试、换文档中断、迟到旧响应、超长内容、React 文本转义。
- 图谱：现有 submission 幂等、作用域切换、失败关闭和 poll 测试全部保留；新增控制器生命周期、选择/定位、resize/fullscreen 退出的纯适配逻辑测试。
- 页面真实操作：列表搜索/清空、上传抽屉及校验错误、切片分页、检索结果/无命中/不可用、节点和边详情/来源、缩放/适配/全屏及 Escape；未登录/无权限/403/过期与租户切换。真实上传、检索或构建仅根授权的人为操作，不为浏览器验收自动重复模型。
- 门禁：pnpm test:services、pnpm build:dev、secret 扫描、diff 检查，检查 1280/768/390 宽度；构建不替代实际浏览器交互。

本批 UI 生产代码实施时按仓规范只升一次 patch（当前 1.0.5，实施前复核远端占用）；设计本身不升版。主会话审核方案后再写实现计划和 UI 代码，Git/CI 与实际 UI 验收分别交付。

## AI 模型路由工作台（同批 1.0.6）

主会话已授权实施。用户已选择 LiteLLM，部署和接入由主会话另行完成；当前页面只消费真实 AI 服务的 GET/PUT `/api/ai/model-selection`，不宣称 LiteLLM 已接入，不提供未部署链接，也不发模型测试请求。

- 当前路由显示返回的 provider/model/updatedAt；空模型或时间明确标缺失，不猜值。支持卡片只来自 supportedProviders，标“服务支持”，不推断密钥配置、连通性或供应商健康。
- 保留现有 canSeeAiModel 入口规则，新增 canChangeAiModel：PLATFORM_SUPER_ADMIN 与 user:auth:manage 必须同时满足；其余进入者只读，后端仍负责真实鉴权。
- 仅允许服务声明的支持项，当前项不可提交。更改前弹窗列出当前和目标供应商，并说明影响全部租户后续使用默认路由的请求；接口没有目标模型编辑能力，不伪造模型下拉或任意端点配置。
- 加载失败显示安全错误和只读重试，不回退硬编码供应商。PUT 只发一次；网络、超时或不可信响应进入不确定状态，自动仅 GET 查回。查回失败时保留警示并禁用写入，用户可继续只读核对；查回只说明当前实际值，不把不匹配解释成原写入必然失败。
- 页面按用户/租户及修改能力重建状态，纯异步控制器在身份改变或卸载后拒绝旧响应、旧提示和旧确认。已发送写入不宣称由前端取消。
- 新增权限、真实 service 参数、状态机和实际展示组件的离线回归；不新增依赖，不显示 key/endpoint，不 build 干扰当前 dev。LiteLLM 选型不扩大为本页面编辑供应商秘密的授权。

## 启动失败时的安全会话恢复

本轮独立缺陷是 `getInitialState` 将资源请求的所有失败视为身份失效，超时、403、5xx 也清理会话。实际单次请求为何取消另行诊断；本修复不推定缺 Bearer、不改认证头、不放宽权限。

- 只在实际 HTTP401 或现有身份失效码 A0220/A0230 的失败响应时清理。200 畸形、关键字段缺失、其他业务失败、403、超时及 5xx 均进入固定安全恢复状态；保留原 token，但不返回 currentUser、缓存权限或菜单资源。
- 正常成功引导从当前 User 资源响应构造权限、管理员分类、资源和可切换租户，缓存只保留同一用户的显示及会话续期元数据；不将旧 adminType/permissions 重新授权给页面。
- `childrenRender` 在渲染 Outlet 前直接返回恢复组件；已安装 Umi 的 `unAccessible` 分支使用同一恢复组件。受保护子组件不被渲染，租户切换器不显示，无 token 仍回登录。
- 恢复页只提供主动“重试”和“退出登录”。重试只发一次只读 bootstrap，并发点击不增加请求；成功后回既有工作台，避免旧路由的无权限缓存残留。恢复成功前不渲染缓存用户视图，无静默自动重试。
- 重试中卸载、会话改变或退出会使旧结果失效；旧请求的 401 不能清除后来建立的新会话。退出仍尝试服务撤销并清本地状态，即使撤销失败也完成本地退出。
- bootstrap 使用现有 request/interceptor，只增加 currentResources 的可选 signal/skipErrorHandler，让本入口显示固定安全恢复信息，不显示原始异常或先弹原始全局错误。
- 实际 app VM、真实恢复组件和已装 Umi Exception 的回归先 RED 后 GREEN；覆盖 401/403/500/超时、200 契约错误、正常/无 token、受保护组件未渲染、重试并发/迟到、退出成功/失败。该专项 12 项，整合全量 132 项，0 skipped；当前不 build，最终统一构建和浏览器由主会话完成。
