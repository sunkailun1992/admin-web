# AI 目录管理规范

本规范约束 AI 在 `admin-web` 后台前端中新增、移动、拆分和命名目录的方式。目录管理必须基于当前 Umi Max、Ant Design Pro、React、TypeScript、pnpm 和 ProComponents 项目结构，不套用 Java 后端目录规则。

## 核心依据

- Umi Max 项目约定：运行时配置、权限、页面、model、service 和路由配置围绕 `src/` 与 `.umirc.ts` 组织。
- React 主流结构：页面按业务域组织，可复用组件放 `src/components`，状态逻辑优先放 hooks/model，API 调用集中在 services。
- TypeScript 项目约定：类型定义靠近 service 或业务域，公共类型放稳定命名空间，不使用散落的 `any` 文件。
- Ant Design Pro 范式：页面优先复用 `PageContainer`、`ProTable`、`ModalForm`、`ProForm*`。
- pnpm / Node 项目约定：依赖目录、构建产物、框架生成目录和缓存目录不进入 Git。
- GitHub / AI 规范：CI 放 `.github/workflows/`，AI 规范放 `docs/ai-coding/`，根目录只保留 `AGENTS.md` 作为入口。

## 当前标准目录

```text
.
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── .umirc.ts
├── src/
├── mock/
├── docs/ai-coding/
├── scripts/
└── .github/
```

当前前端源码目录职责：

| 目录 | 职责 |
| --- | --- |
| `src/app.ts` | Umi 运行时配置、登录态、请求拦截和全局错误处理。 |
| `src/access.ts` | 前端权限判断。 |
| `src/assets` | 图片、静态资源和样式素材。 |
| `src/components` | 可复用业务组件。 |
| `src/constants` | 常量、枚举映射、权限码、存储 key 和固定选项。 |
| `src/hooks` | 可复用 React Hook。 |
| `src/models` | Umi model 和跨页面状态。 |
| `src/pages` | 路由页面，按业务域组织。 |
| `src/services` | API 请求、请求适配器和接口类型。 |
| `src/utils` | 无业务状态的纯工具函数。 |
| `mock` | 本地开发 Mock，不作为后端契约来源。 |

## 目录规则

- 新增页面必须放 `src/pages/<Domain>/<Feature>`，并同步 `.umirc.ts` 路由、权限和 README 说明。
- 新增接口必须放 `src/services/<domain>`，页面不直接拼 `fetch`、`axios` 或裸 URL。
- 新增可复用 UI 放 `src/components`；只服务单个页面的局部组件优先放在页面目录内。
- 新增固定状态、选项、权限码和 HTTP 方法映射放 `src/constants`，不散落在页面中。
- 新增跨页面状态优先使用 Umi initialState、access、model 或局部 hook，不为了小状态引入新全局目录。
- 当前前端按页面域、service、组件和公共能力分层组织；当某个业务域页面、局部组件、hooks、model、service 类型持续膨胀，且改动总是跨多个目录联动时，才评估在 `src/pages/<Domain>/<Feature>` 或明确 feature 目录内聚相关文件。演进必须有真实维护痛点，不为小页面强行建复杂目录；跨域复用稳定后再抽到 `src/components`、`src/hooks`、`src/services` 或 `src/utils`。
- 框架生成目录和缓存目录不得提交，例如 `src/.umi`、`src/.umi-production`、`.turbopack/`、`dist/`、`node_modules/`。
- AI 规范统一放 `docs/ai-coding/`；根目录不再新增 `AI_*.md`、`*_SPEC.md` 或临时分析文档。
- 当前仓库不得嵌套 `user`、`message`、`gateway`、`utils`、`ai` 等同级项目副本；跨项目修改必须切换到真实同级仓库。

## 变更流程

1. 先判断文件属于页面、组件、service、类型、hook、model、常量、配置、脚本、文档还是 CI。
2. 查找现有同类目录，优先复用，不新增平行体系。
3. 移动页面或 service 时同步 import、路由、权限判断、README 和 AI 规范引用。
4. 前端目录变更和后端接口契约变更分开说明，不能用前端目录整理掩盖接口行为变化。
5. 执行 `git diff --check`，涉及源码目录变化时执行 `pnpm build` 或说明无法执行的原因。

## 检查清单

- 是否符合 Umi Max / React / TypeScript / Ant Design Pro 主流目录约定？
- 是否保持页面、service、component、hook、model、constant 边界清晰？
- 是否避免把后端逻辑、鉴权兜底或租户隔离规则放进前端目录？
- 是否没有提交 `node_modules`、`dist`、`.umi`、`.turbopack`、IDE 文件或本机路径？
- 是否没有嵌套同级项目副本？
- 是否没有移动或替换已有 API 地址、token、生产配置和密钥？
