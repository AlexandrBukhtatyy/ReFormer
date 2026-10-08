/**
 * Фикстуры прогона `embedded`. Тесты импортируют `test` и `expect` отсюда.
 *
 * Набор тот же, что у остальных тестов (`tests/shared/fixtures.ts`), но «диск» — каталог
 * приложения-образца с зеркалом записи на настоящий диск, а страница — приложение, поверх
 * которого включается билдер.
 *
 * @module tests/embedded/shared/fixtures
 */

import { test as base, expect } from '@playwright/test';
import { HostApp } from './host-app.pom';
import { HostDisk } from './host-disk';

interface EmbeddedFixtures {
  /** «Диск» с приложением-образцом. Выбор каталога уже подменён; заполняет его `host.openProject()`. */
  disk: HostDisk;
  /** Приложение со встроенным билдером. Страница ещё не открыта. */
  host: HostApp;
  /**
   * Ошибки страницы за тест — `console.error` и необработанные исключения, в верхнем документе
   * и в рамках превью. Ошибка в консоли проваливает тест сама: и билдер, и приложение отказы
   * не роняют, а пишут.
   */
  pageErrors: string[];
}

export const test = base.extend<EmbeddedFixtures>({
  disk: async ({ page }, use) => {
    const disk = new HostDisk(page);
    await disk.install();
    await use(disk);
    // Копия на настоящем диске общая для всех тестов: тронутое возвращается на место.
    disk.restore();
  },

  host: async ({ page, disk }, use) => {
    const host = new HostApp(page, disk);
    await host.builder.recordNotifications();
    await use(host);
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
