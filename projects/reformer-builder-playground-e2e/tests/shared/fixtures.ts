/**
 * Фикстуры e2e билдера. Тесты импортируют `test` и `expect` отсюда, а не из `@playwright/test`.
 *
 * @module tests/shared/fixtures
 */

import { test as base, expect } from '@playwright/test';
import { BuilderApp } from './builder-app.pom';
import { PlaygroundDisk } from './playground-disk';

interface BuilderFixtures {
  /** «Диск» с копией playground. Выбор каталога уже подменён; заполняет его `builder.openPlayground()`. */
  disk: PlaygroundDisk;
  /** Билдер. Страница ещё не открыта: тест сам решает, с проектом он начинает или без. */
  builder: BuilderApp;
  /**
   * Ошибки страницы за тест: `console.error` и необработанные исключения.
   *
   * Билдер отказы не роняет, а пишет в консоль («проект не открыт», «плагины каталога
   * не загрузились») и остаётся рабочим — глазами сценария такой отказ не виден. Поэтому
   * ошибка в консоли проваливает тест сама, без проверки в каждом из них. Тест, которому
   * ошибка нужна по сценарию, разбирает список сам и очищает его (`length = 0`).
   */
  pageErrors: string[];
}

export const test = base.extend<BuilderFixtures>({
  disk: async ({ page }, use) => {
    const disk = new PlaygroundDisk(page);
    await disk.install();
    await use(disk);
  },

  builder: async ({ page, disk }, use) => {
    const builder = new BuilderApp(page, disk);
    await builder.recordNotifications();
    await use(builder);
  },

  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      await use(errors);
      expect(errors, 'ошибки в консоли страницы').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
