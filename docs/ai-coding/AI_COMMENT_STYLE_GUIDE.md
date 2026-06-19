# AI 注释规范

本规范约束 AI 在 `admin-web` 项目中新增或修改注释的方式。项目是 Ant Design Pro + Umi Max + React + TypeScript 前端，注释必须服务于组件维护、接口契约、权限边界和状态流转。

## 0. AI 执行流程

- 修改注释前先识别文件类型和上下文，例如 TS、TSX、React 组件、Umi 配置、Less、JSON、YAML、Shell 或 Markdown。
- 优先阅读 `AGENTS.md`、`docs/ai-coding/AI_CODING_GUIDE.md`、`docs/ai-coding/AI_ENGINEERING_GUARDRAILS.md`、`docs/ai-coding/SECURITY_CODING_SPEC.md`。
- 本规范未覆盖的文件类型，先查官方或主流规范，补充规范来源和本项目落地规则后再改代码。
- 不为了统一注释风格批量重排页面、路由、配置或生产地址。

## 1. 总原则

- 自解释优先：能用清晰组件名、函数名、类型、常量和拆分后的状态表达的意图，先重构代码，不用注释补救。
- 注释只解释代码看不出的内容：权限边界、接口契约、状态流转、缓存策略、错误处理、上传下载风险和跨页面联动。
- 不给 import、普通 JSX、简单 state setter、显而易见的 props 透传或普通样式逐行加注释。
- 禁止逐行翻译式注释，例如“设置变量”“返回结果”“调用接口”。
- 禁止用注释保留废弃组件、旧 JSX、调试按钮、临时 console 或整块旧代码；历史版本交给 Git。
- 注释必须随代码同步更新，过时注释必须删除或修正。
- 作者、创建时间、邮箱和修改历史交给 Git 记录；TSDoc/JSDoc 不写 `@DateTime`、`@email`、`@ClassName`、`@explain` 等非标准标签。

## 2. TypeScript / TSX 注释

- 复杂组件、可复用 hooks、权限判断、请求转换、表单提交转换和跨页面状态应使用函数或组件前置说明，说明职责、边界和安全约束。
- 接口类型优先通过类型名和字段名表达语义；只有字段业务含义不明显、与后端契约强绑定或有兼容边界时才补充注释。
- 表格列、表单项、弹窗状态、批量操作、上传下载和缓存读写只在业务意图或安全边界不明显时说明。
- 错误处理注释应说明用户可见提示、登录态清理、权限失败和后端统一响应的处理边界。
- 禁止用 `any` 配合注释绕过类型建模；应先补充类型。

## 3. 样式、配置和脚本注释

- Less 注释只解释布局约束、响应式原因或与 Ant Design 默认样式的冲突，不解释普通颜色和间距。
- Umi、路由、权限和 request 配置注释应解释运行边界、网关路径和登录态策略。
- JSON 不支持注释；需要说明时写入相邻 Markdown 文档或配置说明，不伪造注释字段。
- Shell 注释解释安全边界、错误处理、密钥脱敏和退出码，不解释普通命令。
- Markdown 文档把关键规则写成可见正文，不用隐藏注释承载规范。

## 4. 格式和美观度

- 维持当前文件缩进、空行、换行宽度和段落风格，不在同一文件混用多套注释风格。
- 组件和函数说明应短而完整，避免把实现细节写成大段散文。
- 行尾注释只用于短枚举或既有对齐风格；造成列宽混乱或 JSX 难读时改为块上方注释。
- 不为了“看起来整齐”改动 token、网关地址、后端地址、默认账号或生产配置所在行。
- 提交前从 diff 视觉检查一次：注释应让页面逻辑更容易扫读，而不是更乱。

## 5. 检查清单

- 注释是否解释了代码看不出的“为什么”？
- 是否可以用更好的命名、类型、常量、hook 或组件拆分替代注释？
- 是否存在注释掉的旧 JSX、调试代码、临时 console 或废弃实现？
- 是否泄露 token、后端地址、默认账号、个人路径或内部令牌？
- 缩进、换行、对齐和段落是否与当前文件风格一致？

## 6. 参考依据

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Docs](https://react.dev/learn)
- [Ant Design Pro Components](https://procomponents.ant.design/)
- [Umi Max](https://umijs.org/)
- [CommonMark Specification](https://spec.commonmark.org/current/)
- Robert C. Martin《Clean Code》第 4 章 Comments：注释是次优手段，优先让代码自解释；注释掉的代码应删除。
