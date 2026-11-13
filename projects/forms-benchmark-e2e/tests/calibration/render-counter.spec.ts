/**
 * Калибровка счётчика рендеров на странице с заранее известными числами
 * (forms-benchmark/src/calibration/main.tsx). Без зелёной калибровки bench не запускается.
 */
import { expect, test } from '@playwright/test';
import { installRenderCounter, type RenderSnapshot } from '../../lib/probes';

declare global {
  interface Window {
    __renders: { snapshot(): RenderSnapshot; reset(): void };
    __bench: { ready: Promise<number>; idle(): Promise<number> };
  }
}

test('счётчик рендеров совпадает с известными числами', async ({ page }) => {
  await page.addInitScript(installRenderCounter);
  await page.goto('/calibration/');
  await page.evaluate(() => window.__bench.ready);

  const mount = await page.evaluate(() => window.__renders.snapshot());
  expect(mount.bundleType, 'страница должна быть prod-сборкой React').toBe(0);
  expect(mount.components).toBe(7);

  const click = async (testId: string) => {
    await page.evaluate(() => window.__renders.reset());
    await page.getByTestId(testId).click();
    await page.evaluate(() => window.__bench.idle());
    return page.evaluate(() => window.__renders.snapshot());
  };

  const bump = await click('calib-bump');
  expect(bump.commits).toBe(1);
  expect(bump.components).toBe(4);

  const leaf = await click('calib-leaf');
  expect(leaf.commits).toBe(1);
  expect(leaf.components).toBe(1);
});
