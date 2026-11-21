import { expect, type Page } from '@playwright/test';

/**
 * 等页面正文画出来、首屏数据取完再检查：布局先于按需加载的页面块出现，只看 main 可见会在正文渲染前就判定就绪
 * （冷启动的开发服务上实际截到过只有布局的空白页）。以 main 里出现该页的菜单名为准（面包屑或页面标题，
 * 用户看得见的文字，不依赖组件库的类名），再等两帧让挂载时的请求发出，最后等页面里的加载转圈都消失。
 */
export async function waitForPageContent(page: Page, menuName: string) {
  const main = page.locator('main');
  await expect(
    main.getByText(menuName, { exact: true }).first(),
    menuName,
  ).toBeVisible({ timeout: 15_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(main.locator('.ant-spin-spinning'), menuName).toHaveCount(0, {
    timeout: 15_000,
  });
}
