# AI 编码规范入口

本目录集中维护 `admin-web` 后台前端的 AI 编程规范。根目录 `AGENTS.md` 只保留项目入口和最高优先级边界；细分规范统一放在本目录。

## 阅读顺序

1. 根目录 `AGENTS.md`
2. 根目录 `README.md`
3. `AI_CODING_GUIDE.md`
4. `AI_DIRECTORY_STRUCTURE_GUIDE.md`
5. `AI_COMMENT_STYLE_GUIDE.md`
6. `AI_DESIGN_PATTERN_GUIDE.md`
7. `AI_AUTOMATION_WORKFLOW.md`
8. `AI_ENGINEERING_GUARDRAILS.md`
9. `BRANCHING_SPEC.md`
10. `ENVIRONMENT_CONFIG_SPEC.md`
11. `VERSIONING_SPEC.md`
12. `SECURITY_CODING_SPEC.md`
13. `TESTING_SPEC.md`
14. 要改的应用的 `src/routes.tsx`（子应用）或 `apps/shell/src`（主应用）、它的 `src/services`，涉及共享能力时再读对应共享包

专题说明：`RAG_NEO4J_GRAPH.md`（知识图谱接入）、`RAG_SERVICE_PATH_FIX.md`（RAG 接口路径的历史修正）。

## 目录结构

```text
docs/ai-coding/
  README.md
  AI_CODING_GUIDE.md
  AI_DIRECTORY_STRUCTURE_GUIDE.md
  AI_COMMENT_STYLE_GUIDE.md
  AI_DESIGN_PATTERN_GUIDE.md
  AI_AUTOMATION_WORKFLOW.md
  AI_ENGINEERING_GUARDRAILS.md
  BRANCHING_SPEC.md
  ENVIRONMENT_CONFIG_SPEC.md
  VERSIONING_SPEC.md
  SECURITY_CODING_SPEC.md
  TESTING_SPEC.md
  RAG_NEO4J_GRAPH.md
  RAG_SERVICE_PATH_FIX.md
```

## 必读结论

- 长期只保留 main；完整交付 main 并远端确认后才清理本任务短分支，保护未合入、dirty 与其他 worktree。详见分支规范。
- 本项目是 pnpm 工作区加 Turborepo 单仓：`apps/*` 是主应用与四个 Module Federation 子应用，`packages/*` 是共享包（物料、主题、请求、会话、多语言、各类配置）。不套用 Java 后端目录规则。
- 升级、选型和架构设计先查证国际主流做法（GitHub 上多个同类主流项目的多数做法、官方文档、标准与论文），不为了缩小改动范围采用偷懒的写法；详见 `AI_DESIGN_PATTERN_GUIDE.md`。
- 分支命名、短分支生命周期、release/hotfix、tag 和分支清理按 `BRANCHING_SPEC.md` 处理。
- 环境、Nacos namespace、Java profile 和前端网关地址边界按 `ENVIRONMENT_CONFIG_SPEC.md` 处理。
- 项目版本、公共包依赖和后端 Java 新项目基础坐标按 `VERSIONING_SPEC.md` 处理；纯 AI 规范或 README 改动不提升制品版本。根 `package.json` 与五个应用同号，共享包固定 `0.0.0` 且不发布。
- 前端测试按 `TESTING_SPEC.md` 分层；单元、组件和页面测试隔离真实接口，真实网关一组只连接 test 环境。
- 页面放各应用的 `src/pages`，接口放 `src/services`，路由与菜单在子应用的 `src/routes.tsx`；跨应用复用的组件进 `packages/ui`，不在应用之间复制。
- 构建产物与缓存目录不得提交，例如 `dist/`、`.turbo/`、`node_modules/`、`storybook-static/`、`e2e-out/`、`packages/ui/public/r/`。
- 前端权限和展示不能替代后端鉴权、租户隔离、字段级授权和数据权限。
