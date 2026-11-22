/**
 * 全仓库测试共用的时限（照 Turborepo 官方 with-vitest 示例，把共用的测试配置放进一个配置包）。
 *
 * CI 用 GitHub 托管的 4 核运行器，Turborepo 同时跑各包的测试（各自起 Vitest 与浏览器），比本机慢几倍。
 * 两个默认值在那里不够：Testing Library 的 findBy*、waitFor 只等 1 秒，懒加载页面光是 React 19
 * 显示 Suspense 内容的节流（FALLBACK_THROTTLE_MS）就占 300 毫秒；Vitest 单个用例默认只给 5 秒。
 * Meta Sapling、Safe、Okta、Materialize 等项目都在测试初始化里统一调大这两项。
 * 条件一满足就返回，通过的用例不会因此变慢，只是失败时多等一会儿。
 */

/** Testing Library 的 findBy*、waitFor 默认最长等待（毫秒）。 */
export const ASYNC_UTIL_TIMEOUT = 5_000;

/** Vitest 单个用例的上限（毫秒）：比最长的一次等待宽得多，失败时先看到带页面结构的报错。 */
export const TEST_TIMEOUT = 15_000;
