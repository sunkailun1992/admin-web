# GitHub 前端环境配置规范

代码只保留 main 长期分支；实际构建、后端地址和部署环境独立选择，不能由分支名推断已部署。

## 前端边界

前端不直接连接 Nacos，不保存 Nacos 地址、namespace、数据库、Redis、MQ、对象存储私钥或生产密钥。后端连接与业务配置由对应 Java 服务和其独立 Nacos 环境管理；不要在前端创建 Java profile、DDL 或复制后端公共工具。

## Umi / React 构建入口

- `.env.dev`、`.env.test`、`.env.prod` 只保存可公开构建变量，例如 UMI_APP_BACKEND_BASE_URL、UMI_APP_RELEASE_VERSION、UMI_APP_TRAFFIC_LANE；浏览器包内变量不可作为 secret。
- pnpm dev、pnpm dev:test、pnpm build:test、pnpm build 选择现有构建入口；真实值以仓库脚本及对应文件为准。
- 本地网关默认 http://localhost:7100；service 使用集中 baseURL，不把本机地址写入页面。当前用户中心 `/auth/**` 不追加 `/user` 前缀。
- 个人 RAG 网关路径与后端保持 `/api/rag/**`，`RAG_SERVICE_PREFIX` 为空，不追加 `/rag`；message 仍沿用自己的模块前缀，不能批量清空所有 service 前缀。
- 后端 Nacos SDK/Console/gRPC 端口和私有连接文件属于后端服务，不写入前端环境文件。

## 验证与发布

- 开发、测试和正式网关按实际环境独立配置；不能把公司地址或业务配置复制到个人入口。
- 前端展示、隐藏按钮和请求头不能替代后端身份、租户、权限与文件访问控制。
- 测试使用假配置、mock/stub 和明确测试环境；普通测试不连接真实后端或生产环境。
- 构建成功、部署和真实环境验收分别报告；新建分支不等于已有自动部署。
- 本仓 CI/自动化入口以实际 workflow 为准，不继承公司 GitLab/Jenkins lane。
