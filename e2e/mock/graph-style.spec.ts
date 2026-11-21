import { expect, test, type Locator } from '@playwright/test';
import { unexpectedProblems, watchConsole } from '../support/console';
import { consoleAllowlist } from '../support/console-allowlist';
import { mockBackend } from '../support/mockApi';

// Rag/Graph/index.less 用 :global 覆盖了 7 个 antd 内部类名；升级 antd 后这些类名若改了，样式会静默失效、页面错位，
// 警告和单元测试都发现不了。这里把页面带到每条规则生效的状态，核对每个类名都还能命中元素。
const atLeastOne = async (scope: Locator, selector: string) =>
  expect
    .poll(() => scope.locator(selector).count(), {
      message: selector,
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

test('graphStyleOverridesStillMatch', async ({ page }) => {
  const problems = watchConsole(page);
  const unmocked = await mockBackend(page);
  await page.goto('/rag-knowledge/graph');
  const content = page.locator('main');
  await expect(content).toBeVisible({ timeout: 15_000 });
  await expect(content.locator('.ant-spin-spinning')).toHaveCount(0, {
    timeout: 15_000,
  });
  // 筛选面板的表单。
  await atLeastOne(content, '.ant-form');
  await atLeastOne(content, '.ant-form-item');

  // 构建状态里的详情折叠面板：展开后才有内容区。
  await content.getByText('查看构建详情').click();
  await atLeastOne(content, '.ant-collapse-header');
  await atLeastOne(content, '.ant-collapse-content-box');

  // 选中节点后详情面板的页签。画布渲染完、视图控制按钮可用之后，定位节点才会选中它。
  await expect(
    content.getByRole('button', { name: '适配当前图谱' }),
  ).toBeEnabled({ timeout: 15_000 });
  await content.getByRole('combobox', { name: '定位当前结果节点' }).click();
  await page.getByTitle('合成实体').click();
  await atLeastOne(content, '.ant-tabs-tab');

  // 最大化查看时画布区的加载容器。
  await content.getByRole('button', { name: '全屏查看图谱' }).click();
  await atLeastOne(content, '.ant-spin-nested-loading');
  await atLeastOne(content, '.ant-spin-container');

  expect(unmocked).toStrictEqual([]);
  expect(unexpectedProblems(problems, consoleAllowlist)).toStrictEqual([]);
});
