# 统一配置工作台实施计划

**目标：** 增加 LiteLLM 原生管理统一入口、真实只读模型目录及具有安全写入状态机的中文文件存储工作台。

**架构：** 既有 Umi/AntD/ProComponents、集中 AI service 与类型，局部纯模型/请求控制器处理白名单、乐观锁、未知结果和身份门闩；保留旧业务模型切换算法。

**已审核设计：** `docs/superpowers/specs/2026-11-11-unified-configuration-design.md`。本会话继续实施，无额外设计审批。

## 实施步骤

- [x] 冻结模型只读和存储 BO/VO、状态枚举、错误与查回语义；接口合同与后端逐字段一致。
- [x] RED→GREEN：模型摘要白名单、固定原生入口、安全 URL、能力/验证状态、搜索与未知状态。
- [x] 添加模型与能力页，复用现业务默认路由 controller，保留 `/ai/model`。
- [x] RED→GREEN：存储 payload KEEP 省略、不可变位置、签名秒边界、请求作用域、未知操作只 GET、CAS 冲突和旧 probe revision。
- [x] 添加存储表格、Provider Drawer、操作/探测状态抽屉和确认动作。
- [x] 添加统一配置导航与严格超管权限；同步 README、service 合同、版本一次升至 `1.0.7`。
- [x] 定向及全量 `pnpm test:services`、`pnpm exec tsc --noEmit`、格式、安全与 diff 检查；通知主会话协调停止 dev 后才执行 `pnpm build:dev`。
- [ ] 主会话浏览器验证真实目录、权限、空态、异常、窄屏及原生控制台登录边界；不以 mock 或静态构建替代。
- [ ] fresh fetch、正常集成 main、push 后读回精确 SHA 与 CI；不改 NAS、Nacos 或实际密钥。

## 验证与交付边界

- 风险按高风险处理：新增全局配置入口、单向凭据提交、默认切换与元数据删除；后端鉴权、加密、引用和版本检查仍为权威。
- 本批版本只从 `1.0.6` 提升至 `1.0.7` 一次，未增加依赖，pnpm 锁文件不存项目版本，未改锁文件。
- `pnpm test:services`：157/157，通过，0 skipped；其中统一配置新增 25 项。覆盖真实 service 请求与真实组件展示，不访问真实接口。
- `pnpm exec tsc --noEmit`、`bash scripts/check-secrets.sh`、Prettier 和 `git diff --check` 通过。
- 主会话现场核对并停止自有 dev、确认端口释放后，本轮一次 `pnpm build:dev` 成功；未自行重启。主会话负责新标签页和真实配套后端浏览器验收。
- 初始复数 `Models` 目录被 Umi `plugin-model` 当作保留的 `models` 目录扫描，产生大小写重复导入。已改为单数 `Model`，公开路由仍 `/configuration/models`；生成的错误 model 导入已消失，未关闭 TypeScript 检查。
- 未修改 NAS/Nacos/真实供应商凭据，未登录 LiteLLM，未发模型请求或真实存储探测，不把 mock/构建成功称为实际供应商连接通过。
- 回滚前端仅撤下管理入口，后端配置与旧对象引用继续保留；不删除配置、桶或文件，不把 LiteLLM DB 模型源回迁 Nacos。

## 后续修复：1.0.8 原生别名目录

固定 LiteLLM v1.108.4 的 `model_group_alias` 与 wildcard 展开保留原 `model_info.id`；同一个 deployment 可以合法对应多个 `model_name`。此前前后端以 ID 全局唯一拒绝整个合法目录，主会话已批准改为 `(id, modelName)` 精确复合身份。

- [x] 合成但符合真实响应 DTO 的双别名 fixture：同 ID、不同名称必须保留，完全相同 pair 重复仍拒绝；原 decoder 先 RED `DUPLICATE_MODEL_ID`。
- [x] 真实 Table rowKey 回归：原字符串 `id` 先 RED；改为精确 pair 的稳定 JSON 键，不修改真实 ID、不丢别名，不引入持久化新标识。
- [x] 保留名称原始字符作为身份，目录分别统计部署 ID 数与记录数，避免别名膨胀物理部署数量。
- [x] 全量 159/159 测试（0 skipped）、类型、安全、格式与 diff 检查通过；主会话确认自有 dev 停止/端口释放后，本轮一次 `build:dev` 成功（utoo 3049ms）。公开 API 与存储代码保持。
- [ ] fresh fetch 后正常 main/精确 SHA CI；源码 stable 后才通知 dev 重启，避免 checkout 窗口。

依据：[固定版本 alias 复制](https://github.com/BerriAI/litellm/blob/e6f080fb5633aa71ea81b652bd72069aff1f0228/litellm/router.py#L12562)、[固定版本 wildcard 展开](https://github.com/BerriAI/litellm/blob/e6f080fb5633aa71ea81b652bd72069aff1f0228/litellm/proxy/auth/model_checks.py#L381)。fixture 为合成元数据，无代理实例/模型调用；真实部署验收仍由主会话负责。
