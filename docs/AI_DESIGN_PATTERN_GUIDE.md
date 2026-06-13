# AI 设计模式规范

本规范约束 AI 在 `admin-web` 中选择、引入和调整设计模式的方式。项目是 React + TypeScript + Umi Max + Ant Design Pro 前端，不能照搬 Java 后端的继承和 Service 分层。

## 1. 总原则

- 先识别当前文件类型：TSX 页面、React 组件、Hook、service 请求、类型声明、Umi 配置、样式或脚本。
- 优先使用 React 和 Ant Design Pro 主流模式：组件组合、Hook、受控表单、service adapter、容器/展示拆分。
- 不为了“设计模式”新增类层级、抽象基类或复杂状态容器。
- 模式必须服务前端真实边界：接口契约、权限资源、登录态、表格表单复用、错误处理、路由和请求拦截。
- 前端模式不能替代后端鉴权、租户隔离、字段级授权或数据权限。

## 2. 标准参考

- React 官方组合模型、Hooks 规则和 Context 使用边界。
- TypeScript 官方类型系统和结构化类型。
- Ant Design Pro / ProComponents 官方页面、表格、表单范式。
- Umi Max 运行时配置、路由、access 和 request 约定。
- GoF 设计模式只作为命名语言，落地时优先使用函数、组件和 Hook，而不是 Java 式继承。
- SOLID 原则用于判断职责、依赖方向和模块边界。

## 3. 本项目推荐模式

### Component Composition

适用页面、表格、弹窗、按钮和状态展示。

- 优先组合 `PageContainer`、`ProTable`、`ModalForm`、`ProForm*`。
- 可复用 UI 放 `src/components`，不要在多个页面复制 JSX。
- 避免卡片套卡片和过度包装组件。

### Container / Presentational Split

适用复杂页面。

- 容器组件处理请求、权限、路由参数和状态。
- 展示组件只接收 props 并渲染。
- 简单 CRUD 页无需强拆，复杂度出现后再拆。

### Custom Hook

适用可复用状态和副作用。

- 登录态、表格刷新、选择器联动、权限判断等重复逻辑可抽 Hook。
- Hook 必须以 `useXxx` 命名，并遵守 Hooks 规则。
- 不把一次性页面逻辑过早抽成 Hook。

### Service Adapter

适用后端接口调用。

- 所有远程请求集中在 `src/services`。
- 页面不直接拼 `fetch`、`axios` 或网关地址。
- 后端响应、错误码、分页结构和权限字段在 service/type 层统一建模。

### Context / Provider

适用全局登录态、权限资源、主题或运行时配置。

- 优先使用 Umi initialState、access 和 request 运行时能力。
- Context 只放真正跨页面共享的状态。
- 不用 Context 替代简单 props，也不把服务端权限结果前端伪造。

### Strategy / Mapping

适用状态、分类、权限码、HTTP 方法、资源类型等固定映射。

- 固定选项集中放 `src/constants`。
- 用映射表替代散落的 `if/else`。
- 映射值必须来自后端契约或明确需求。

### Reducer / State Machine

适用复杂表单、批量操作或多步骤流程。

- 简单弹窗表单用 `useState` 和 ProForm 即可。
- 状态迁移复杂时才使用 `useReducer` 或显式状态机。
- 状态机不能绕过后端权限或乐观锁。

## 4. 谨慎或禁止使用

- Java 式抽象类、继承层级和 Service Locator。
- 全局 event bus，除非有明确生命周期和清理策略。
- 过早引入 Redux/Zustand 等状态库；当前项目优先 Umi initialState、request 和局部状态。
- `any` 泛滥；确需兼容第三方库时把范围限制到最小。
- 在组件中直接拼接接口 URL、权限码或后端字段。
- 用前端模式替代后端安全控制。

## 5. 检查清单

- 是否优先使用 Ant Design Pro / ProComponents 官方范式？
- 是否把请求放在 `src/services`，类型放在稳定位置？
- 是否用组件组合和 Hook 解决复用，而不是复制 JSX？
- 是否没有新增无必要状态库、全局事件或复杂继承？
- 是否保持后端 API、权限码、DTO/VO 字段一致？
- 是否执行 `pnpm build` 覆盖类型和构建问题？
