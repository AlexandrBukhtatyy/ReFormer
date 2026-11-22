/**
 * Кит HexaUI в e2e: плагин проекта, его известный шум в консоли и выбор кита в строке состояния.
 *
 * Общие для двух наборов: билдера в своей вкладке (`tests/kit.spec.ts`) и встроенного в
 * приложение-образец (`tests/embedded/hexa.spec.ts`).
 *
 * @module tests/shared/hexa-kit
 */

import { expect, type FrameLocator, type Page } from '@playwright/test';
import type { BuilderApp } from './builder-app.pom';

/**
 * Кит из плагина проекта: пакет `kit-hexa-ui` в `.ui_builder/plugins` playground.
 *
 * Его сборка весит около 5 МБ, поэтому в обычную копию проекта каталог кита не входит —
 * тесты кита просят его явно.
 */
export const KIT_PLUGIN = 'kit-hexa-ui';

/**
 * Шум HexaUI в консоли: кит объявляет React до 18-го, а билдер работает на 19-м, и antd
 * со styled-components внутри кита пишут предупреждения (README кита, «Ограничения»). Форма при
 * этом рисуется. Сюда попадает только известное — всё прочее по-прежнему проваливает тест.
 */
export const KNOWN_KIT_NOISE = [
  /React does not recognize the `%s` prop on a DOM element/,
  /`onSearch` should work with `showSearch`/,
  /Accessing element\.ref was removed in React 19/,
  // `Text` HexaUI кладёт styled-проп `$color` прямо на DOM-узел (`createElement(htmlTag, {
  // $color })`), и React отвергает имя атрибута. Им подписаны шаги `Wizard`, поэтому шум приходит
  // с визардом кита. Это не React 19: дефект самого HexaUI, рисованию он не мешает.
  /Invalid attribute name: `%s` \$color/,
];

/**
 * Убирает из ошибок страницы известный шум кита — зовётся в `afterEach`, до проверки консоли
 * фикстурой. Массив правится на месте: его же проверяет фикстура.
 */
export function dropKnownKitNoise(pageErrors: string[]): void {
  const unexpected = pageErrors.filter(
    (message) => !KNOWN_KIT_NOISE.some((pattern) => pattern.test(message))
  );
  pageErrors.splice(0, pageErrors.length, ...unexpected);
}

/**
 * Выбирает кит HexaUI в ячейке строки состояния.
 *
 * Ячейка «кит» — вклад плагина китов. Пока кит один, она подпись; кнопкой она становится, когда
 * плагин внёс второй, — а плагины проекта поднимаются после открытия, поэтому список
 * переоткрывается. Кит меняется на лету, без перезагрузки.
 *
 * `menus` — документ, где открывается меню: страница билдера (по умолчанию) либо рамка
 * встроенного билдера.
 */
export async function selectHexaKit(
  builder: BuilderApp,
  page: Page,
  menus: Page | FrameLocator = page
): Promise<void> {
  const cell = builder.statusBar.getByRole('button', { name: 'ReFormer UI Kit' });
  const hexa = menus.getByRole('menuitemradio', { name: /Kaspersky HexaUI/ });
  await expect(async () => {
    await cell.click();
    try {
      await expect(hexa).toBeVisible({ timeout: 1_000 });
    } catch (error) {
      await page.keyboard.press('Escape');
      throw error;
    }
  }).toPass();

  await hexa.click();
  await expect(builder.statusBar.getByRole('button', { name: 'Kaspersky HexaUI' })).toBeVisible();
}
