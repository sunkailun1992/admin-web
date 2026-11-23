# AI 设计模式规范

本规范约束 AI 在 `admin-web` 中选择、引入和调整设计模式的方式。项目是 React + TypeScript 的 Module Federation 单仓前端，不能照搬 Java 后端的继承和 Service 分层。

## 1. 总原则

- 升级、选型和架构设计先查证主流做法：对照 GitHub 上多个同类主流项目的源码与文档，以多数做法为准，不以单个项目为准；同时查官方文档、RFC 与标准、NIST / OWASP 等权威指南和相关论文，在设计或说明里写明依据与来源。不为缩小改动范围或省事采用非主流的简化做法；确需缩小范围时，写清主流做法与简化做法的差别和代价，由维护者决定。
- 只看国际主流方案（第6阶段起），不以国内框架的约定为准。
- 先识别当前文件类型：TSX 页面、物料或业务组件、Hook、service 请求、类型声明、纯逻辑、构建配置、样式或脚本。
- 优先使用 React 主流模式：组件组合、Hook、受控表单、服务适配层、容器与展示拆分。
- 不为了“设计模式”新增类层级、抽象基类或复杂状态容器。
- 模式必须服务前端真实边界：接口契约、权限资源、会话、子应用接入、表格表单复用、错误处理、路由和请求拦截。
- 前端模式不能替代后端鉴权、租户隔离、字段级授权或数据权限。

## 2. 标准参考

- React 官方组合模型、Hooks 规则和 Context 使用边界。
- TypeScript 官方类型系统和结构化类型。
- shadcn/ui 与 Radix UI 官方组件写法、WAI-ARIA 创作实践（对话框、菜单、树形等模式）。
- TanStack Query、TanStack Table、react-hook-form 与 zod 官方用法。
- Module Federation 官方文档（运行时注册、共享单例、运行时插件）。
- GoF 设计模式只作为命名语言，落地时优先使用函数、组件和 Hook，而不是 Java 式继承。
- SOLID 原则用于判断职责、依赖方向和模块边界。

## 3. 本项目推荐模式

### Component Composition

适用页面、表格、弹窗、按钮和状态展示。

- 优先组合 `@admin-web/ui` 的物料与业务组件（`DataTable`、`FormDialog`、`ConfirmAction` 等）。
- 跨应用复用的 UI 进物料包，不要在多个页面或应用复制 JSX。
- 避免卡片套卡片和过度包装组件。

### Container / Presentational Split

适用复杂页面。

- 容器组件处理请求、权限、路由参数和状态；展示组件只接收 props 并渲染，便于写故事与测试。
- 简单增删改查页无需强拆，复杂度出现后再拆（如知识图谱的画布、详情、构建状态各自独立）。

### Custom Hook

适用可复用状态和副作用。

- 会话、租户、列表分页、选择器联动、权限判断等重复逻辑抽 Hook（如 `useTenants`、`usePagedList`）。
- Hook 必须以 `useXxx` 命名，并遵守 Hooks 规则与 React Compiler 的 lint 规则（不在渲染中读写 ref、不在 effect 里同步设 state）。
- 不把一次性页面逻辑过早抽成 Hook。

### Service Adapter

适用后端接口调用。

- 远程请求集中在各应用的 `src/services`，经本应用的请求客户端发出。
- 页面不直接拼 `fetch`、`axios` 或网关地址。
- 后端响应、错误码、分页结构和权限字段在 service/type 层统一建模，回包在边界处解码校验。

### Context / Provider

适用全局会话、权限资源、查询客户端、主题与语言。

- 会话与权限由 `@admin-web/auth` 的 Provider 提供，经共享单例给子应用；服务端状态用 TanStack Query 的 QueryClient。
- Context 只放真正跨页面共享的状态；不用 Context 替代简单 props，也不在前端伪造服务端权限结果。

### Strategy / Mapping

适用状态、分类、权限码、HTTP 方法、资源类型等固定映射。

- 固定选项集中放常量映射（共享的在共享包，本应用的在应用内），显示文案走 i18n 键。
- 用映射表替代散落的 `if/else`；映射值必须来自后端契约或明确需求。

### Reducer / State Machine

适用复杂表单、批量操作或多步骤流程。

- 简单弹窗表单用 `FormDialog` 即可。
- 状态迁移复杂时用 `useReducer` 或显式的控制器（如存储操作、图谱构建的提交、查回与轮询）；把状态与迁移写成纯函数，单独测试。
- 状态机不能绕过后端权限或乐观锁；结果不确定的写操作只读查回，不自动重发。

### Plugin / Module Registry

适用子应用接入与扩展。

- 子应用按 `RemoteRoutes` 契约暴露路由与菜单，主应用按运行时清单注册，不在主应用里写死子应用。
- 构建期能力经 `defineAppConfig` 组合，运行期能力经 Module Federation 运行时插件；不在应用里各写一份配置。

## 4. 谨慎或禁止使用

- Java 式抽象类、继承层级和 Service Locator。
- 全局 event bus，除非有明确生命周期和清理策略。
- 引入 Redux/Zustand 等全局状态库；服务端状态用 TanStack Query，会话用 `@admin-web/auth`，其余用局部状态。
- 子应用之间互相引用源码，或绕过共享单例各带一份 React、路由、查询客户端。
- `any` 泛滥；确需兼容第三方库时把范围限制到最小。
- 在组件中直接拼接接口 URL、权限码或后端字段。
- 用前端模式替代后端安全控制。

## 5. 检查清单

- 是否查证并写明了主流依据？是否优先使用物料包与官方范式？
- 是否把请求放在应用的 `src/services`，类型放在稳定位置？
- 是否用组件组合和 Hook 解决复用，而不是复制 JSX？
- 是否没有新增无必要状态库、全局事件、复杂继承或跨应用源码引用？
- 是否保持后端 API、权限码、DTO/VO 字段一致？
- 是否执行 `pnpm check` 覆盖类型、测试和构建问题？
