# RAG 请求路径修复

## 需求与边界

个人网关与 RAG Controller 公开 `/api/rag/**`，管理前端沿用额外 `/rag` 模块前缀，造成文档列表与图谱请求在网关返回 404。本次统一前端请求路径，保留现有认证、权限、租户、参数、上传协议和超时；不改后端、Nacos、数据库或公司项目。

## 验收标准

- 文档列表、上传、校验、停用、检索、图谱查询和同步均请求 `/api/rag/**`，不重复追加模块前缀。
- 各接口保持原有 HTTP 方法、query/body、文档 ID 编码和长任务超时。
- 真实个人 dev 的文档列表和图谱查询返回成功，未登录访问仍被拒绝；联调不上传文件、不调用付费模型、不修改知识内容。
- 普通 service 测试只执行真实 TypeScript 常量和请求封装，以网络替身捕捉请求，不连接真实接口或读取环境文件。

## 开发与验证入口

- `src/constants/auth.ts`：统一 RAG 模块前缀，与 `../utils/ops/github-dev/nacos/DEFAULT_GROUP/gateway-spring.yaml` 及 `../rag` Controller 契约一致。
- `tests/unit/rag-service-routing.test.mjs`：覆盖七类请求的最终 URL、方法与参数，使用现有 Node 测试器和 TypeScript 转译器，无新增依赖。
- `pnpm test:services`：执行请求认证与 RAG 请求契约测试；CI 使用相同入口。
- `pnpm build:dev` 与密钥扫描验证本地构建；普通 CI 使用 dev 构建，不读取 `.env.prod`。

## 发布与回滚

前端补丁版本由 `1.0.0` 升为 `1.0.1`。开发服务器可通过热更新加载新常量，浏览器刷新后核对请求路径。无需重启 Java 服务或发布配置；回滚旧前端制品会恢复错误前缀，数据库不受影响。真实浏览器页面操作与 API 联调分别报告。
