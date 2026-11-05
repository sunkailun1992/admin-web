# 实体图谱前端接入

## 需求与验收

前端通过既有 Java 门面展示 LlamaIndex 抽取、Neo4j 保存的实体与关系，同时兼容关闭新图后端时的旧结构图。Qdrant 仍保存来源切片；浏览器不接触内部服务地址、凭据、活动来源快照或数据库。

- 实体、关系标签和可点击详情可读；未知节点类型不会导致画布或详情崩溃。
- 节点与关系都显示公开的多来源证据；未知属性不进入视图，摘录只显示普通文本。
- 异步任务接收、构建成功、失败和取消分别展示；失败不清除已有图，不撤销活动向量。
- 知识库切换、后续查询和卸载取消旧请求，旧响应不覆盖当前状态；真正的网络错误、401 和 403 继续走原处理。
- 图谱查看、管理与完整文档切片权限保持独立。

## 接口与类型

| 入口 | 请求与响应 |
| --- | --- |
| `GET /api/rag/graphs` | 原 `knowledgeBase/query/nodeType/viewMode/limit`；原 Graph VO 可选追加 `backend: neo4j` 和 `build` |
| `POST /api/rag/graphs/sync` | 原知识库参数和四计数；可选追加 `buildId/status`，存在任务时不解释为同步完成 |
| `GET /api/rag/graphs/builds/{buildId}` | 必带 `knowledgeBase`，返回完整 GraphBuild；任务标识保持单路径段编码 |
| `POST /api/rag/documents` | 原 multipart；响应可选追加 `graphBuild` 与 `graphStatus`，不改变向量结果 |

`GraphBuild` 包含 `buildId/knowledgeBase/status/documentCount/processedDocumentCount/nodeCount/edgeCount`，可选 `errorCode/createdAt/updatedAt`。状态仅为 `QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED`。前端核对任务、知识库及非负整数计数，处理文档数不能大于总数，不用未知值或请求接收计数伪造进度。构建的 nodeCount/edgeCount 是来源局部实体/关系的出现次数，页面明确这样命名并提示其与当前聚合图数量不同；例如两个来源各有相同 6 个实体时，构建出现次数可为 12，而展示聚合节点为 6。旧同步响应没有 GraphBuild，不受该说明影响。

新增节点类型为 `ENTITY`，关系类型为 `RELATED_TO`，其余类型和 `OVERVIEW/DETAIL` 保留。新 Neo4j 后端实际返回实体语义图，两种 viewMode 暂为相同数据；页面读到 `backend=neo4j` 后只提供实体筛选、隐藏结构视图。若发现沿用旧结构节点筛选，会清除该条件并重查一次；尚未取得后端信息时不改筛选。旧来源结构只在 legacy 后端展示，不对新模式承诺文档/区段/记录节点。

节点和关系的来源统一位于 `properties.sources[]`；总数与截断标志为同级 `properties.sourceCount/sourceTruncated`。来源身份由后端核验，前端仅展示来源名称、格式、文档编码与版本、切片标识、定位、章节、公开元信息及证据摘录。每条来源可带严格布尔 `evidenceTruncated/evidenceNormalized`：前者为 true 时无论文本长度都提示局部摘录并要求核对原文/完整切片；后者为 true 时显示「格式已归一」，说明空白或字形规范化定位。非布尔或继承属性不会触发旗标。单项最多显示 8 个来源，前端最多显示 2000 字符，主动裁短也明确提示。缺少信息时不推测；前端白名单不替代服务端授权。

## 文件与状态链路

- `src/services/rag/`：统一网关接口、可选字段和取消信号，不增加 `/rag` 前缀或前端租户字段。
- `src/pages/Rag/Graph/graphModel.ts`：类型安全兜底、证据白名单、任务响应检查、请求有效期和可取消轮询。
- `src/pages/Rag/Graph/GraphSources.tsx`：节点与关系共享来源视图，保留文档切片权限判断。
- `src/pages/Rag/Graph/index.tsx`：查询、关系选择、二次确认、构建状态、恢复轮询与失败提示。
- `src/pages/Rag/Document/index.tsx`：向量上传结果和图谱结果分开提示。
- `src/app.ts`：仅静默无 HTTP 状态的 `ERR_CANCELED/AbortError`；不按错误消息文字判断取消。

轮询先读取完整任务，再每 2 秒续读未终结任务，失败或取消停止更新；成功后重查图谱。状态读取失败保留图与最后已知任务，可重试状态读取。来源的完整切片按钮复用已有分页窗口，不自动定位选中切片。

## 权限与测试

图页仍要求 `menu:rag:graph + rag:graph:view`；重建要求 `rag:graph:manage`；完整切片入口仍要求 `menu:rag:document + rag:document:manage`。所有实际授权由 Java 执行。证据以 React 文本渲染，不使用 HTML 注入，不展示任意模型属性或原始后端异常。

使用现有 `node:test` 与 TypeScript 转译器，不增加测试栈。`rag-graph-model.test.mjs` 覆盖未知类型、多来源、非法字段、异步状态、作用域、取消和上传结果；`rag-graph-sources.test.mjs` 使用已安装的 React/Ant Design 做真实服务端渲染，核对 XSS 转义、来源和完整切片按钮权限；service 测试验证路径、方法、知识库和 AbortSignal；request-auth 测试验证静默取消及未吞掉真实失败。

执行 `pnpm test:services`、`pnpm exec tsc --noEmit`、`pnpm build:dev`、`bash scripts/check-secrets.sh` 和 `git diff --check`。真实浏览器的画布点击、缩放、重建确认、知识库切换、登录失效及网关联调另行记录；离线测试与构建不替代这些验收。普通测试不访问真实后端。

## 回滚

配套 Java 关闭新图后端可恢复旧结构投影，前端保留旧 Graph VO 和同步响应读取。恢复前端版本也不改写既有图谱、文档或向量；不通过前端删除 Neo4j、MySQL 或 Qdrant 数据。
