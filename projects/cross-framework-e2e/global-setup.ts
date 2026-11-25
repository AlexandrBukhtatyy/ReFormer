/**
 * Прогрев страниц хостов до тестов.
 *
 * Хосты идут с dev-серверов. На холодном кеше dev-сервер дособирает зависимости при первом
 * открытии страницы и перезагружает её: тест, попавший на эту перезагрузку, падает не по вине
 * формы. Прогрев открывает каждую страницу, пока она не дойдёт до готовности без перезагрузки.
 */
import { chromium } from '@playwright/test';
import { pageUrl, selectedStacks } from './stacks';

const ATTEMPTS = 5;

interface BenchWindow {
  __bench?: { ready: Promise<number> };
}

export default async function warmUp(): Promise<void> {
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage();
    for (const stack of selectedStacks()) {
      for (const form of stack.forms) {
        const url = pageUrl(stack, form);
        let lastError: unknown;
        let ready = false;
        for (let attempt = 0; attempt < ATTEMPTS && !ready; attempt++) {
          try {
            await page.goto(url);
            await page.waitForFunction(() => Boolean((window as BenchWindow).__bench), null, {
              timeout: 60_000,
            });
            await page.evaluate(() => (window as BenchWindow).__bench!.ready);
            ready = true;
          } catch (error) {
            // Перезагрузка страницы сервером рвёт контекст исполнения — открываем заново.
            lastError = error;
          }
        }
        if (!ready) {
          throw new Error(`Страница ${url} не дошла до готовности: ${String(lastError)}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
}
