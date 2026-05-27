# AI 代码编写指导规范

本文档用于约束 AI 在本项目中生成、修改和审查前端代码。项目基线为 Ant Design Pro、Umi Max、React、TypeScript、Ant Design 5 和 ProComponents。

## 基本原则

- 先读后端接口、DTO、VO、权限码和现有前端结构，再写代码。
- 不凭空新增接口字段、路由、权限码或状态值；字段必须来自后端代码、接口文档或明确需求。
- 优先使用 Ant Design Pro 官方范式：`PageContainer`、`ProTable`、`ModalForm`、`ProForm*`、`StatisticCard`。
- 业务页面保持 CRUD 闭环：查询、新增、编辑、删除、错误提示、刷新表格。
- 所有远程请求集中放在 `src/services`，页面不直接拼 axios/fetch。
- 所有登录态、Token、请求拦截、错误处理集中放在运行时配置和工具函数中。
- 不提交本地文件、构建产物、依赖目录、IDE 配置和缓存文件。

## 目录规范

```text
src/
  app.ts                     # Umi 运行时配置、登录态、请求拦截
  access.ts                  # 前端权限判断
  constants/                 # 常量、枚举映射、存储 key
  components/                # 可复用业务组件
  pages/                     # 路由页面
  services/                  # API 请求与接口类型
  utils/                     # 纯工具函数
docs/
  AI_CODING_GUIDE.md         # AI 编码规范
```

页面目录按业务域组织：

```text
src/pages/System/Tenant
src/pages/System/User
src/pages/System/Role
src/pages/System/Resource
```

## TypeScript 规范

- 禁止使用 `any` 绕过业务类型；确需兼容第三方库时范围必须最小。
- 后端响应统一建模为 `API.ApiResponse<T>`。
- 分页响应统一建模为 `API.Page<T>`，页面层只消费 `records`、`total`、`current`、`size`。
- 表单入参使用后端 `*BO` 类型，查询入参使用后端 `*Query` 类型，表格行使用后端 `*VO` 类型。
- 可选字段用 `?`，不要用空字符串表达缺失值；提交前用 `cleanPayload` 去掉 `undefined`。

## Ant Design Pro 规范

- 列表页使用 `ProTable`，弹窗表单使用 `ModalForm`。
- 查询区字段与后端 `*Query` 保持一致。
- 表格 `rowKey` 必须使用稳定主键 `id`。
- 新增、编辑、删除成功后调用 `actionRef.current?.reload()`。
- 危险操作必须使用 `Popconfirm` 二次确认。
- 状态、分类、HTTP 方法等固定选项集中放在 `src/constants`。
- 页面标题使用 `PageContainer title`，不要额外堆叠说明性卡片。

## 请求规范

- 登录接口：`POST /auth/login`。
- 登录前租户下拉接口：`GET /auth/tenants`。
- 当前用户资源接口：`GET /auth/resources`。
- 管理接口统一位于 `/auth/manage/**`。
- 角色资源编辑必须先用 `GET /auth/manage/role-resources` 回显历史资源，再用 `PUT /auth/manage/role-resources` 按完整勾选结果同步。
- 编码生成接口：`GET /auth/manage/codes/generate`。
- 请求头统一追加：

```text
Authorization: Bearer <token>
```

- 后端统一响应 `success=false` 时必须抛错并展示 `errorMessage` 或 `msg`。
- 401、403 必须清理本地登录态并跳转 `/login`。
- 前端通过 Umi request `baseURL` 直接请求后端 `http://localhost:7500`，不要再为 `/auth` 单独配置 dev proxy。

## 权限规范

- 后端权限码来自 `permissions`，前端菜单资源来自 `frontendResources`。
- 后端管理权限码为 `user:auth:manage`。
- 前端菜单资源码：

```text
menu:tenant
menu:user
menu:role
menu:resource
```

- `access.ts` 只做布尔判断，不发请求、不写存储、不产生副作用。
- 路由中的 `access` 必须使用 `access.ts` 中定义的能力名。

## 登录态规范

- Token 存储 key：`admin_web_access_token`。
- 登录用户信息存储 key：`admin_web_login_info`。
- `getInitialState` 在存在 Token 时调用 `/auth/resources` 刷新权限资源。
- 页面跳转由 `layout.onPageChange` 统一兜底，未登录用户进入业务页必须跳转 `/login`。

## 表单规范

- 新增必填字段必须与后端 `Save` 校验组一致。
- 编辑必传 `id` 和 `version`，保证后端乐观锁生效。
- 租户内资源必须提交 `tenantId`。
- 用户编辑不展示密码字段，新增用户必须填写密码。
- 编码字段创建后默认不可编辑，避免破坏唯一约束和授权关系。
- 所有需要输入业务编码的表单必须提供“生成”按钮，按钮只能调用后端 `GET /auth/manage/codes/generate`，禁止前端自行拼接或随机生成编码。
- 编码生成请求必须传 `target`，租户用 `TENANT`，角色用 `ROLE`，权限资源用 `RESOURCE`；资源编码还要传 `resourceCategory`，便于后端生成 `menu:` 或 `api:` 命名空间。

## 资源树规范

- 权限资源以 `parentId` 组织树，不在前端新增其它父子字段。
- 权限资源列表使用树形 `ProTable`，角色绑定资源使用树形多选。
- 编辑资源父级时必须排除自身及子孙节点，避免形成循环树。

## 样式规范

- 优先使用 ProComponents 和 Ant Design 默认样式。
- 只在页面需要明显布局差异时新增 `.less`。
- 不使用大面积单色渐变、装饰性空卡片、嵌套卡片。
- 表格、表单、弹窗宽度要稳定，避免内容变化导致布局跳动。

## 交付规范

- 每次功能变更后至少执行：

```bash
pnpm build
```

- 修改登录、路由、权限、请求拦截后必须本地打开页面验证。
- 提交前检查：

```bash
git status --short --ignored
```

- 不允许提交：

```text
node_modules/
dist/
.turbopack/
src/.umi/
src/.umi-production/
.idea/
*.iml
.DS_Store
*.log
```
