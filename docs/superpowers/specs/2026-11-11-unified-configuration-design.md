# 统一配置工作台设计

主会话已审核方案并授权实施。模型定义、供应商凭据、虚拟密钥、额度与用量由 LiteLLM 原生控制台管理；本后台不建立第二套模型 CRUD。文件存储由 AI 后端数据库和 XFileStorage 动态注册负责，环境连接与加密根配置仍归 Nacos/env。

## 导航与权限

- 新增“统一配置”，下设“模型与能力”“文件存储”，仅平台超级管理员且具有 `user:auth:manage` 可进入。
- 保留 `/ai/model` 和原有只读权限、业务默认切换 controller。新模型页复用该 controller，不另造任务写入 API。
- 身份、租户或权限变化时清空局部工作台、凭据表单与选择，中止等待并忽略迟到响应；后端仍为权限权威。

## 模型与能力

- 提供 LiteLLM 的模型部署、虚拟密钥、额度、用量和 Playground 五个原生入口。固定 v1.108.4 源码确认路由，链接由已核 `/ui` 根派生，不携带 token，不自动登录，不嵌 iframe。
- 只展示后端返回的本环境已配置 deployment，支持名称/provider 搜索及能力筛选。语言、向量、重排、OCR、语音、图片、视频等分类不等于业务已接入。
- 管理 API 可用、模型已配置、实际连接验证、业务已接入分别表达；缺少验证记录显示“未验证”，不在加载页面时调用模型。
- 保留现有业务默认路由变更与确认。RAG 索引绑定模型只读，清楚显示变更需索引重建的限制。
- 使用 `GET /api/ai/model-control-plane` 的白名单摘要，不展示任意原始 model_info、header、凭据或错误对象。

## 文件存储

- 主体为配置表，显示供应商、平台标识、桶、上传状态、当前默认、凭据已配置、保存/生效 revision、引用数和最近探测。
- Provider Drawer 按后端支持的 OSS/COS/MinIO 类型显示必要字段；平台、供应商和对象位置在创建后固定，位置变化新建配置。
- 凭据 `KEEP` 时完全省略密钥字段；`REPLACE` 时成对输入，仅保留在当前表单内存，提交/关闭/身份变化后清除，不回显旧值。
- 签名有效期使用秒并遵循后端边界。首轮不提供关闭历史读取开关，停用上传只影响新写入。
- 默认切换、编辑、删除均携带乐观版本与明确确认。默认配置或存在引用时禁止删除，最终检查由后端完成。
- 读写探测必须用户明确触发，展示写入、读取、清理状态和安全错误码；旧 revision 的探测不显示为当前配置验证成功。
- 未知写入结果保留 requestId，通过只读操作查询恢复，不自动重复 POST/PUT/DELETE。未知结果不能变成新的操作。

## 视觉与实现边界

沿用现有 Ant Design/ProComponents、字号与蓝色操作主题，使用紧凑表格和抽屉，状态文字伴随颜色。窄屏容器允许表格局部横滚，长模型/endpoint 文本换行，禁止页面横向溢出。无新增依赖、图标字体或全局样式覆盖。

普通测试隔离真实接口，覆盖字段白名单、凭据省略、权限双判、版本冲突、未知操作只读查回、晚回包、旧探测状态和安全链接。主会话负责停 dev 后统一构建、真实浏览器与跨服务验收；构建通过不代表连接验证通过。

## 公开依据

- [LiteLLM v1.108.4 导航源码](https://github.com/BerriAI/litellm/blob/e6f080fb5633aa71ea81b652bd72069aff1f0228/ui/litellm-dashboard/src/components/leftnav.tsx)
- [LiteLLM 模型单一配置源](https://docs.litellm.ai/docs/proxy/ui_store_model_db_setting)（新版文档能力须与固定版本区分）
- [XFileStorage 2.3.0 构建器](https://github.com/dromara/x-file-storage/blob/2.3.0/x-file-storage-core/src/main/java/org/dromara/x/file/storage/core/FileStorageServiceBuilder.java)
- [公开 RuoYi-Vue-Pro FileConfig 工作台接口](https://github.com/YunaiV/ruoyi-vue-pro/blob/master/yudao-module-infra/src/main/java/cn/iocoder/yudao/module/infra/controller/admin/file/FileConfigController.java)（借鉴模式，不照搬 GET 测试副作用或签名 URL 返回）
