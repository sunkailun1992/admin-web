# 前端测试分层规范

本文档约束 `admin-web` 的前端测试策略。前端测试默认与真实后端隔离，只有明确标记为 E2E 或联调验证时，才允许请求 test 环境真实网关。

## 核心原则

- 测试目标是验证用户可见行为、请求契约、权限展示和安全边界，不测试 React、Umi、Ant Design Pro 或浏览器本身。
- 普通 CI 默认不访问真实后端接口，不读取 `.env.prod`，不使用生产 token，不改生产数据。
- `pnpm build` 只能证明项目可构建，不能替代表单、权限、请求 header、异常提示和页面交互测试。
- 前端权限、按钮隐藏和菜单控制只是体验层保护，不能替代后端鉴权、租户隔离和数据权限。
- 修改测试时必须说明覆盖的真实业务风险，不能只断言 mock 返回值。

## 测试分层

| 层级 | 目标 | 推荐工具 | 是否访问真实接口 |
| --- | --- | --- | --- |
| 静态门禁 | 编译、类型、格式、构建产物 | `pnpm build`、TypeScript、Prettier | 否 |
| 单元测试 | 权限判断、枚举映射、参数转换、小工具函数 | Vitest | 否 |
| 组件测试 | 表格、表单、弹窗、按钮权限、错误提示 | React Testing Library + Vitest | 否 |
| Service/API 测试 | 请求路径、query/body、header、响应转换 | Vitest + MSW | 否 |
| E2E 测试 | 登录、租户、用户、角色、资源管理关键链路 | Playwright | 只允许 test 环境 |

## 当前门禁

当前仓库尚未引入 Vitest、Testing Library、MSW、Playwright 等测试依赖。任何功能改动至少执行：

```bash
pnpm build
bash scripts/check-secrets.sh
```

修改登录、路由、权限、请求拦截、环境变量、网关地址或核心管理页面时，还必须本地打开页面验证，并说明验证的页面、账号环境、请求路径和失败场景。

## 标准脚本

引入前端测试栈后，`package.json` 应保持以下语义。脚本名称可以因工具差异微调，但职责不能弱化：

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e:test": "playwright test",
    "check": "pnpm typecheck && pnpm test && pnpm build"
  }
}
```

引入测试栈后，普通 PR 默认执行 `pnpm check` 和 `bash scripts/check-secrets.sh`。发布前或修改核心链路时执行 `pnpm test:e2e:test`。

## 单元测试规则

- `src/access.ts` 权限判断必须覆盖有权限、无权限、未登录和资源为空。
- 参数转换函数必须覆盖空值、分页、排序、搜索条件、`tenantId` 和 `version`。
- 枚举、状态、标签、颜色、文案映射必须覆盖未知值兜底。
- 不为 Ant Design 内部行为写单元测试；只验证本项目自己的业务逻辑。

## 组件测试规则

- 页面组件测试以用户行为为中心，优先按文本、角色、label、按钮名称查找元素。
- 租户、用户、角色、权限资源页面至少覆盖列表渲染、新增弹窗、编辑回显、表单校验和提交按钮状态。
- 权限相关组件必须覆盖有权限显示、无权限隐藏或禁用、接口失败提示。
- 表单提交测试必须验证最终传给 service 的字段，特别是 `tenantId`、`id`、`version`、分页参数和业务编码。
- 不直接断言组件内部 state、私有方法或 Ant Design 生成的脆弱 DOM 结构。

## Service/API 测试规则

- `src/services/auth/index.ts` 是请求测试重点，必须验证用户中心接口统一追加 `/user` 网关前缀后的最终路径。
- 认证请求必须验证 `Authorization`、`X-Release-Version`、`X-Traffic-Lane` 等 header 的传递规则。
- 列表查询必须验证分页、搜索、排序字段和字段白名单参数。
- 新增和编辑请求必须验证请求体不携带前端临时字段；编辑请求必须携带后端乐观锁 `version`。
- Service 测试默认使用 MSW 或等价网络层 mock 拦截请求，不打真实 `localhost:8080`、test 或 prod 网关。

## E2E 测试规则

- E2E 只允许连接 test 环境网关，禁止连接 prod。
- E2E 使用测试租户、测试账号和可清理的测试数据；新增数据必须带有稳定测试前缀，便于回收。
- 核心 E2E 链路至少覆盖登录、租户列表、用户列表、角色列表、权限资源列表和一次新增/编辑/删除闭环。
- E2E 失败时必须保留截图、trace 或控制台日志，不能只给一句“页面异常”。
- 生产发布前如未执行 E2E，交付说明必须明确未执行原因和剩余风险。

## 禁止事项

- 禁止自动化测试读取 `.env.prod` 或生产账号。
- 禁止在普通单元/组件/service 测试中请求真实后端。
- 禁止为了测试通过关闭权限、关闭请求拦截、跳过 token、删除租户 header 或硬编码管理员身份。
- 禁止把真实 token、账号密码、手机号、邮箱、身份证、内网地址写入测试代码。
- 禁止只用快照测试覆盖核心业务页面；快照只能作为低价值辅助。
