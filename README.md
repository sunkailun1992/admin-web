# Admin Web

`admin-web` 是用户中心后台管理前端，基于 Ant Design Pro / Umi Max 构建，对接同级 `user` 后端项目。

本项目负责登录认证、租户管理、部门管理、用户管理、角色管理、权限资源管理，以及用户角色、角色资源、角色数据范围授权操作；同时提供受独立权限控制的 RAG 文档向量管理、检索试查和知识图谱页面。

`1.0.5` 的图谱手动同步为每次明确操作生成不透明提交键。结果不确定时保留同一身份/租户/KB 下的键，并先通过只读提交查询查回原任务；POST 丢响应只自动查回，不自动重复发送 POST。收到并验证原任务后结束该提交，下次明确重建才换键。重复上传复用该活动文档版本的后端图谱任务，图谱失败需到知识图谱页明确重新构建。配套接口要求 Java RAG `1.2.4` 与 Engine `0.2.7`；页面构建或合成测试不表示目标环境已部署。未新增业务日程或 Conductor 工作流。

`1.0.6` 将知识文档页改为列表工作台：按知识库查询，搜索标题、来源文件或编码，筛选状态/格式；上传、检索测试和命中来源使用独立抽屉。列表分页与筛选作用于已载入数据，切片按后端 cursor 顺序读取并缓存上一页。检索必须明确提交，默认返回 6 条、可选 1–20 条；服务不可用不会显示成无匹配资料。上传文件和目标知识库配合“上传并校验”按钮构成确认，超时不自动重发。身份或知识库切换会中止旧页面等待并忽略迟到结果。

图谱工作台提供当前结果节点定位、缩放、适配和全屏，节点/关系详情分为来源证据、属性和当前结果关联。图例与截断信息靠近画布，构建状态保持任务与已发布结果的区别。选择节点不重建画布，视图按钮不触发图谱构建；重新构建仍须明确确认，未知提交沿用原提交键只读查回。界面交互参考与真实 API 能力映射见[工作台设计](docs/superpowers/specs/2026-11-10-rag-workbench-design.md)。

已认证 user/tenant 明确时，未确认键按 user/tenant/KB 写入同一标签页的 sessionStorage（只存 scope 和不透明键）。刷新或重新进入时优先只读查回，未找到也不自动 POST；用户确认重新构建才允许以原键重发。身份未知时仅在内存保留；存储不可用或内容损坏会阻止创建新提交，不能据此认定旧任务不存在。切换账号/租户会取消旧页面请求并清除旧图显示，旧响应不能覆盖当前身份。

`1.0.7` 新增“统一配置”下的“模型与能力”“文件存储”，两页均要求平台超级管理员身份与 `user:auth:manage`。模型页只读 `GET /api/ai/model-control-plane` 返回的实际 deployment，按语言、向量、重排、OCR、语音、图片、视频分类；管理目录可读不等于模型健康，能力声明不等于业务接入。模型部署、供应商凭据、虚拟密钥、额度、用量及验证使用 LiteLLM 原生控制台的五个固定入口，不重做 CRUD、不携带 token 自动登录、不嵌 iframe。旧 `/ai/model` 路由及只读权限保留，新页面复用原业务默认切换 controller；RAG 索引绑定模型与维度不提供热切换。

文件页按后端 capabilities 提供 OSS、COS、MinIO/S3 兼容配置；位置创建后固定，迁移通过新建和切默认进行。凭据 `KEEP` 完全不提交密钥字段，`REPLACE` 成对单向提交，关闭/提交/身份切换清空表单。停用上传不关闭旧文件读取；默认或有引用配置不能删除。保存版本、生效 revision 和实际读写探测分别显示，历史 revision 的成功不当作当前连接正常。默认指针、签名 TTL（秒）和最大文件字节数通过 settings 乐观锁更新，基础目录、旧空平台映射和私有访问只读。

存储所有变更带不透明 requestId，未知结果只 `GET /api/ai/storage-operations/{requestId}` 查回，不自动重发。已知 user/tenant 的同标签页 sessionStorage 仅保存 scope、requestId、动作及配置 ID，不保存 endpoint、表单或凭据；恢复先 GET，404 也不生成新提交，存储损坏/失败阻止新写入。真实 `READ_WRITE` 探测需明确确认，步骤与清理失败保留，配置保存成功不冒充验证成功。分页、搜索和筛选来自真实服务端，默认选择候选仅当前已加载页，不伪装全量目录。

本批 UI 需要配套 AI 存储和模型控制台摘要接口；未连接时显示未配置或不可读，不使用演示数据填充。配置归属、接口边界和验收计划见[统一配置设计](docs/superpowers/specs/2026-11-11-unified-configuration-design.md)。回滚前端至 `1.0.6` 只撤下新管理入口，不删除后端配置、不回迁 Nacos，也不修改 LiteLLM 的原生模型源。

`1.0.8` 兼容 LiteLLM 原生别名：多个调用名称可合法保留同一个 deployment ID，目录行按 `(id, modelName)` 稳定区分，只有完全相同的行身份重复才拒绝。页面分别显示去重的部署数与目录记录数，不把别名当作新建的物理部署；不修改真实 ID、不丢弃别名、不增加模型调用或配置写入。

`1.0.9` 将存储新操作的 requestId 对齐后端 canonical UUID 合同：使用 16 字节加密随机数并设置 UUID v4/variant 位，不依赖安全上下文限定的 `randomUUID`。新写入在持久化或发送前验证 UUID；旧 pending 不透明键仍原样保留并仅只读查回，读取失败不会自动换键或重新写入。

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
  gatewayBaseUrl: http://localhost:7100
  localPath: ../user
  serviceName: user
  devBaseUrl: http://localhost:7100
  testBaseUrl: http://localhost:7100
  prodBaseUrl: http://localhost:7100
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
| RAG 文档管理 | `/rag-knowledge/documents` | `POST/GET /api/rag/documents`、校验、停用与检索接口 |
| RAG 知识图谱 | `/rag-knowledge/graph` | `GET /api/rag/graphs`、`POST /api/rag/graphs/sync` |
| 模型与能力 | `/configuration/models` | `GET /api/ai/model-control-plane`；复用 `GET/PUT /api/ai/model-selection` |
| 文件存储 | `/configuration/storage` | `GET /api/ai/storage-capabilities`、`GET/POST /api/ai/storage-configurations`、`PUT/DELETE /{id}`、`GET/PUT /api/ai/storage-settings`、显式 probes 与操作只读查询 |

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

RAG 页面采用独立权限，不继承用户中心管理权限：

```text
menu:rag:document + rag:document:manage
rag:retrieval:use
menu:rag:graph + rag:graph:view
rag:graph:manage
```

前端只负责隐藏无权页面和动作；RAG 服务的 `@PreAuthorize` 仍是最终授权边界。

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
  pages/Rag/Document/       # 文档摄取、上传校验、文档版本、读回校验和检索试查
  pages/Rag/Graph/          # 图谱查询、同步和节点来源展示
  services/auth/            # 后端接口封装和 API 类型
  services/rag/             # RAG 服务接口封装和 API 类型
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

本地浏览器验收前，先停止当前 checkout 的开发服务，完成测试与 `pnpm build:dev`，再重新启动 `pnpm dev`。当前 utoo 开发服务和构建使用默认 `dist` 产物目录，在开发服务运行期间构建会替换其中的入口与资源，不应并行执行。若页面混入开发与构建资源、出现 `Unexpected token '<'` 或整页交互无响应，先检查脚本请求是否误返回 HTML；重启开发服务后禁用缓存重新加载，必要时用新标签页验证，不据此直接修改组件事件。

IDEA 的 `.run/` 运行配置保留在本机，不纳入 Git。单独打开本项目和通过聚合工作区打开时，IDEA 的项目根目录不同，请在运行配置中选择本项目的 `package.json`，执行 `dev` 脚本。

前端默认地址：

```text
http://localhost:8000
```

后端接口地址：

```text
.env.dev  -> UMI_APP_BACKEND_BASE_URL=http://localhost:7100
.env.test -> UMI_APP_BACKEND_BASE_URL=http://localhost:7100
.env.prod -> UMI_APP_BACKEND_BASE_URL=http://localhost:7100
```

前端运行时通过 `src/app.ts` 的 `request.baseURL` 直接请求 `UMI_APP_BACKEND_BASE_URL` 指向的网关。当前 USER_SERVICE_PREFIX 为空，`src/services/auth/index.ts` 的 `/auth/**` 直接请求同路径网关，再转发到 user 服务；不额外追加 `/user`。当前 dev/test/prod 暂时都指向 `http://localhost:7100`；后续环境拆开时，只改对应 `.env.*` 文件。开发时需要先启动 `gateway` 和 `user`，并确保 `gateway` 监听 `7100`、`user` 监听 `7500`。如果浏览器出现 CORS 错误，需要在网关允许来自 `http://localhost:8000` 的跨域请求。

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

## 通用安全与架构同步

请求认证由 `src/utils/requestAuth.ts` 统一处理：普通请求携带当前管理员 Bearer，显式 `skipAuth` 的独立认证请求保留调用方认证头并删除内部控制标记。OAuth 标准 `/oauth2/token` 返回 401 时显示固定认证失败提示，不清理管理员会话；其他 401 仍执行原有退出流程。本次不新增 OAuth 管理页面或业务接口。

`pnpm test:request-auth` 覆盖 Bearer、Basic、匿名、内部标记清理和 token 入口精确匹配。`pnpm test:services` 同时覆盖 RAG 与统一配置请求的最终路径、方法、分页参数、凭据省略、未知操作恢复、上传校验与评估报告读取；个人网关直接接收 `/api/rag/**`，`RAG_SERVICE_PREFIX` 为空，不额外追加 `/rag`。当前前端版本为 `1.0.9`，CI 使用 `pnpm build:dev` 验证页面构建，避免普通测试读取生产配置；发布构建入口仍为 `pnpm build`。

## RAG 文档上传

上传入口接受 XLSX、DOCX、PDF、PNG、JPG/JPEG，单文件最多 20 MiB（界面显示 20 MB）。选择文件和提交时均校验扩展名、大小、文件名及浏览器报告的 MIME；没有可靠 MIME 信息时交给后端核对文件头。前置校验不替代后端权限、租户隔离和内容安全检查。

XLSX/DOCX 使用既有 Java 解析；PDF/图片依赖配套 RAG 版本启用文档解析，扫描件还需可用 OCR 服务。前端允许选文件不表示目标环境已启用 OCR，未启用或解析失败沿用统一接口错误提示。上传继续使用原有 `POST /api/rag/documents` multipart 契约，不改变请求身份、租户或字段。

## RAG 切片检视与评估报告

文档列表中的「切片检视」读取 `GET /api/rag/documents/{documentId}/chunks?limit=20&cursor=...`，每次加载 20 条并按后端不透明游标续读。接口必须由配套 Java RAG 版本提供，沿用 `rag:document:manage` 和当前登录租户，不传入可由页面伪造的 `tenantId`。展示真实保存的来源名称、定位、章节、页码、区块类型、坐标、重复来源和切片正文；旧数据缺少元信息时显示「未提供」，不推测页码。关闭窗口会取消未完成的请求，读取失败可重试，不用模拟数据代替。

切片检视与图谱节点详情同时展示后端公开的 `ocr_capabilities`：文字识别（`textRecognition`）、表格结构（`tableStructure`）、版面分析（`layoutAnalysis`）。`false` 明确显示「不支持」，缺失或无效字段显示「未提供」；基础文字 OCR 不代表支持复杂表格或版面解析。页码和区块坐标仅在数值合法时显示，未知元信息字段不进入视图。

「查看评估报告」在浏览器内读取 [RAG 评估工具](../rag/evaluation/README.md) 生成的 `schemaVersion=1` JSON，最大 2 MiB。文件不上传、不写入浏览器存储，关闭窗口即清除页面状态。读取器只接受报告定义字段，并核对明细数量、计数和门禁结果；单独的原始预测文件、查询、正文、凭据等额外字段会被拒绝。原评估器格式展示 Recall/MRR/nDCG、P50/P95、漏召回、误召回、越界命中、逐题结果和报告来源摘要，明确区分离线预测与真实接口采集。

同时支持 `evaluation/live_compare.py` 生成的完整比较报告（例如 `final-report.json`）：Dense/Hybrid 并排展示 Recall/MRR/nDCG、误召回、耗时、错误、泄漏和降级，显示报告实际记录的差值、全局验收检查及临时集合清理结果。报告内的脱敏预测仅用于统计一致性校验，不进入视图；不为单模式伪造 gate，也不会把执行完成当成验收通过。未完成报告、无穷大数值、矛盾计数、差值或清理结果均拒绝导入。该工具直接调用 Python 检索实现，耗时不包含 Java HTTP/RPC 与网络开销。

评估报告是历史记录，字段校验不等于来源真实性认证，门禁通过也不代表线上环境验收。当前指标按来源文档统计；OCR、复杂表格、真实模型及业务文档质量需另配环境和样本验证。没有阈值检查的指标不视为达标。前端测试使用实际 Python 评估器对虚构样本生成的固定报告，不以测试数据声称模型效果。

本批变更不增加菜单、认证方式或权限编码；回滚时恢复前端版本即可，切片与评估读取不修改已入库文档。

## RAG 图谱来源追溯

图谱沿用 `GET /api/rag/graphs` 和 `POST /api/rag/graphs/sync`，兼容原来源结构与规则概念图。配套 Java 开启新图后端后，语义图展示 LlamaIndex 抽取、Neo4j 保存的 `ENTITY` 实体及 `RELATED_TO` 关系；关系以 `label` 展示具体语义。读到 `backend=neo4j` 后，页面仅提供实体筛选并隐藏结构视图选项，旧结构筛选会清除并重查；首次未知后端时保留现有筛选。请求仍兼容 `OVERVIEW/DETAIL`，新模式两者返回语义图，不表示另有文档结构。旧后端的总览继续查看文档与概念，结构明细展示区段和记录。未知节点类型使用安全默认样式。`SECTION` 统一显示为「来源区段」，可对应 XLSX 工作表、DOCX 章节及 PDF / 图片页面；具体范围以已保存的章节、定位与元信息为准。

点击节点或关系可查看来源证据。新图谱读取 `properties.sources[]`、`sourceCount`、`sourceTruncated`，每项最多显示 8 条公开来源；跨文档实体和关系不会被伪装为只有一个来源。来源字段及摘录使用白名单并以普通文本展示，摘录显示最多 2000 字符。每条来源的严格布尔 `evidenceTruncated=true` 会提示摘录已截断、需核对原文或完整切片，即使文本未达到前端上限；`evidenceNormalized=true` 显示「格式已归一」，说明定位使用了空白或字形规范化。前端自行裁短也会提示，不把局部摘录当完整证据。旧节点继续从 `properties.sourceName/sourceType/sourceMetadata` 展示来源文件、格式、页码、区块类型、坐标和 OCR 能力，保留已有 `chunkId/chunkType/sectionPath` 的追溯信息。缺少字段时显示「未提供」。切片坐标属于具体区块，不应当作整页坐标。

证据含 `documentId` 时可通过「查看文档切片」打开与文档列表相同的分页检视窗口，入口同时要求 `menu:rag:document + rag:document:manage`；只有图谱查看权限的账号可读后端公开的图谱证据摘录，不显示完整文档切片入口。分页窗口不会自动定位到某个 `chunkId`。前端不伪造文档字段或租户，后端继续执行最终授权。

「重新构建图谱」沿用 `rag:graph:manage`，二次确认后提交。旧后端返回同步计数时仍按完成处理；新后端返回 `buildId/status` 时仅表示任务已接收，页面调用 `GET /api/rag/graphs/builds/{buildId}?knowledgeBase=...` 读取完整状态，每 2 秒续读排队或运行中的任务，终态停止。图查询返回的可选 `build` 可恢复进行中的任务。构建卡的实体/关系出现次数按来源累计，当前图节点/关系数按查询范围聚合，两者不能直接等同。只有 `SUCCEEDED` 显示完成并刷新图谱，`FAILED/CANCELLED` 保留已显示结果并允许重试，状态读取失败可单独重试。更换知识库、再次查询和离开页面会取消对应旧请求，迟到响应不覆盖当前视图。

上传继续使用原 multipart 契约。配套后端可追加 `graphBuild/graphStatus`，向量成功与图谱排队或失败分别提示，不把图谱失败解释为向量上传失败。前端不连接 Python、Neo4j 或 Qdrant，也不持有模型或数据库凭据。接口、实现与离线验收说明见 [图谱接入说明](docs/ai-coding/RAG_NEO4J_GRAPH.md)；真实模型、网关和浏览器验收需单独执行，前端构建通过不代表环境已启用新后端。
