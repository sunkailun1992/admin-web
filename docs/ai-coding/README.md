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
10. `VERSIONING_SPEC.md`
11. `SECURITY_CODING_SPEC.md`
12. `.umirc.ts`、`src/app.ts`、`src/access.ts`、目标 page / service / component

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
  VERSIONING_SPEC.md
  SECURITY_CODING_SPEC.md
```

## 必读结论

- 本项目是 Umi Max / React / TypeScript / Ant Design Pro 前端，不套用 Java 后端目录规则。
- 分支命名、短分支生命周期、release/hotfix、tag 和分支清理按 `BRANCHING_SPEC.md` 处理。
- 项目版本、公共包依赖和后端 Java 新项目基础坐标按 `VERSIONING_SPEC.md` 处理；纯 AI 规范或 README 改动不提升制品版本。
- 页面放 `src/pages`，接口放 `src/services`，可复用组件放 `src/components`，常量放 `src/constants`。
- 框架生成目录和缓存目录不得提交，例如 `src/.umi`、`src/.umi-production`、`.turbopack/`、`dist/`、`node_modules/`。
- 前端权限和展示不能替代后端鉴权、租户隔离、字段级授权和数据权限。
