# AI 目录管理规范

本规范约束 AI 在 `admin-web` 中新增、移动、拆分和命名目录的方式。目录管理基于当前的 pnpm 工作区加 Turborepo 单仓、Vite、React、TypeScript、Module Federation 与 shadcn/ui 物料包结构，不套用 Java 后端目录规则。

## 核心依据

- pnpm 工作区与 Turborepo 官方单仓结构：可部署的应用放 `apps/*`，共享的内部包放 `packages/*`，内部包直接导出 TypeScript 源码（Turborepo 的 Just-in-Time 包），共用配置做成配置包（如 `config-eslint`、`config-typescript`、`config-vitest`）。
- Module Federation 官方做法：主应用（host）与子应用（remote）各是一个可独立构建、独立部署的应用，只经暴露的入口与共享单例往来。
- shadcn/ui 官方单仓做法：组件源码放共享的 `ui` 包，应用从包入口引用；注册表文件 `registry.json` 与组件放在一起。
- React 主流结构：页面按业务域组织，页面私有组件放在页面目录内，跨应用复用的组件进物料包；API 调用集中在 services。
- pnpm / Node 项目约定：依赖目录、构建产物和缓存目录不进入 Git。
- GitHub / AI 规范：CI 放 `.github/workflows/`，AI 规范放 `docs/ai-coding/`，根目录只保留 `AGENTS.md` 作为入口。

## 当前标准目录

```text
.
├── AGENTS.md
├── README.md
├── package.json            # 根脚本（turbo run …）与仓库级开发依赖
├── pnpm-workspace.yaml     # 工作区与依赖版本 catalog
├── pnpm-lock.yaml
├── turbo.json
├── playwright.config.ts
├── apps/                   # shell、system、message、ai、rag
├── packages/               # ui、theme、theme-emerald、api、auth、i18n、config-*、test-utils
├── e2e/                    # mock、live、fixtures、support
├── turbo/generators/       # turbo gen 模板
├── scripts/
├── docs/ai-coding/
└── .github/
```

应用内目录职责：

| 目录 | 职责 |
| --- | --- |
| `apps/<应用>/src/routes.tsx` | 子应用经 Module Federation 暴露的 `./routes`：路由与菜单元数据。 |
| `apps/<应用>/src/http.ts` | 本应用的请求客户端（`createHttpClient`）。 |
| `apps/<应用>/src/pages/<页面>` | 路由页面与它私有的组件。 |
| `apps/<应用>/src/services` | 接口函数与接口类型（`types.ts`）。 |
| `apps/<应用>/src/lib` | 纯逻辑：模型、校验、状态映射，可单测。 |
| `apps/<应用>/src/dev` | 只在开发时用的单独运行外壳。 |
| `apps/<应用>/test/unit`、`test/pages` | jsdom 单元测试；真实浏览器里的页面测试。 |
| `apps/shell/apps.<mode>.json` | 子应用清单（运行时配置）。 |

共享包职责：

| 包 | 职责 |
| --- | --- |
| `packages/ui` | shadcn/ui 组件源码（`src/components`）、业务组件（`src/business`）、样式入口、Storybook、注册表。 |
| `packages/theme`、`packages/theme-*` | 设计令牌源文件（`tokens/`）与生成的主题样式。 |
| `packages/api` | 请求客户端、响应解包、错误分类、列表与查询工具。 |
| `packages/auth` | 会话、权限规则机制（具体规则在各子应用的 `src/access.ts`）、路由守卫、子应用接入契约类型、单独运行外壳。 |
| `packages/i18n` | i18next 初始化、共享文案（`common`、`shell`）与子应用文案的注册（`addTexts`）。 |
| `packages/config-vite`、`config-eslint`、`config-typescript`、`config-vitest` | 共用的构建、代码检查、类型与测试配置。 |
| `packages/test-utils` | MSW 处理器、按应用方式套好 Provider 的渲染。 |

## 目录规则

- 新增页面放 `apps/<子应用>/src/pages/<页面>`，同时在该子应用的 `src/routes.tsx` 加路由与菜单（`labelKey`、`access`、分组），在它的 `src/locales` 加文案、需要时在 `src/access.ts` 加权限规则，并同步 README 业务范围。
- 新增业务域优先新建子应用（`pnpm turbo gen remote`），在 `apps/shell/apps.<mode>.json` 登记，不把不相关的域塞进现有子应用。
- 新增接口放所属应用的 `src/services`，页面不直接拼 `fetch`、`axios` 或裸 URL；多个应用都要用的类型进共享包。
- 只服务单个页面的组件放页面目录内；同一应用多个页面复用的放应用内公共目录（如 `src/components`）；跨应用复用的进 `packages/ui`（带故事与测试），不在应用之间复制或互相引用源码。
- 共享包只从入口引用（`@admin-web/ui`、`@admin-web/auth` 等），不深层引用 `src`；子应用之间只经 Module Federation 暴露的入口往来（ESLint 拦截）。
- 新共享包放 `packages/<名称>`，`private: true`、版本 `0.0.0`、导出 TypeScript 源码，并加进需要它的包的依赖；配置类的包以 `config-` 开头。
- 构建产物与缓存目录不得提交，例如 `dist/`、`.turbo/`、`node_modules/`、`storybook-static/`、`e2e-out/`、`.vitest/`、`packages/ui/public/r/`。
- AI 规范统一放 `docs/ai-coding/`；根目录不再新增 `AI_*.md`、`*_SPEC.md` 或临时分析文档。
- 当前仓库不得嵌套 `user`、`message`、`gateway`、`utils`、`ai` 等同级项目副本；跨项目修改必须切换到真实同级仓库。

## 变更流程

1. 先判断文件属于哪个应用或共享包，再判断是页面、组件、service、类型、纯逻辑、配置、脚本、文档还是 CI。
2. 查找现有同类目录，优先复用，不新增平行体系。
3. 移动页面或 service 时同步 import、路由与菜单、权限标志、文案键、README 和 AI 规范引用。
4. 前端目录变更和后端接口契约变更分开说明，不能用前端目录整理掩盖接口行为变化。
5. 执行 `git diff --check` 与 `pnpm check`；动了子应用接入或共享包边界时再跑 `pnpm test:deploy`。

## 检查清单

- 是否符合单仓的应用与共享包边界、Module Federation 与 shadcn/ui 的官方目录约定？
- 是否保持页面、service、物料、纯逻辑、配置边界清晰？子应用之间是否没有互相引用源码？
- 是否避免把后端逻辑、鉴权兜底或租户隔离规则放进前端目录？
- 是否没有提交构建产物、缓存、IDE 文件或本机路径？
- 是否没有嵌套同级项目副本？
- 是否没有移动或替换已有 API 地址、token、生产配置和密钥？
