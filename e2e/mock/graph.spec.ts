import { expect, test } from '@playwright/test';
import fixtures from '../fixtures/rag.json' with { type: 'json' };
import { prepare, settled } from '../support/setup.ts';

const graph = fixtures['GET /api/rag/graphs'].data;

test('Cytoscape renders the fixture nodes and fullscreen fills the panel', async ({
  page,
}) => {
  const run = await prepare(page);
  await page.goto('/rag-knowledge/graph');
  await settled(page, '知识图谱');
  await expect(
    page.getByText(
      `画布显示 ${graph.nodes.length} 个节点、${graph.edges.length} 条关系`,
    ),
  ).toBeAttached();
  const canvas = page.getByTestId('graph-canvas');
  await expect(canvas.locator('canvas').first()).toBeAttached();
  await page.getByRole('button', { name: '全屏查看图谱' }).click();
  await expect(
    page.getByRole('button', { name: '退出图谱全屏' }),
  ).toBeVisible();
  const panel = page.getByRole('region', { name: '图谱工作区' });
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return box && [Math.round(box.width), Math.round(box.height)];
    })
    .toStrictEqual([1280, 800]);
  await expect
    .poll(async () => {
      const [container, layer] = await Promise.all([
        canvas.boundingBox(),
        canvas.locator('canvas').first().boundingBox(),
      ]);
      return (
        container &&
        layer && [
          layer.width === container.width,
          layer.height === container.height,
        ]
      );
    })
    .toStrictEqual([true, true]);
  await page.getByRole('button', { name: '退出图谱全屏' }).click();
  await expect(
    page.getByRole('button', { name: '全屏查看图谱' }),
  ).toBeVisible();
  run.verify();
});
