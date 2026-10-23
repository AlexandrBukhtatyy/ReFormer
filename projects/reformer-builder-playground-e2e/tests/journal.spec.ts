import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './shared/fixtures';

/**
 * Журнал: нижняя панель плагина `reformer.journal` из домена `base`.
 *
 * У панели два вида: «Проблемы» — свод находок, и «События» — лента записей, которые оставляют
 * оболочка и плагины. Сквозной сценарий — тот, ради которого журнал заведён: операция над файлом
 * отказала, тост называет отказ и отсылает в журнал, а в журнале лежит запись с именами и
 * исключением, которое раньше видела только консоль.
 */

/** Скриншоты визуальной проверки — рядом с остальными снимками (в git не едут). */
const SHOTS = path.resolve(__dirname, '../../react-playground-e2e/screenshots/journal');

/** Вкладка журнала в полосе нижнего дока. Имя начинается с заголовка, дальше — значок. */
function journalTab(page: Page): Locator {
  return page.getByRole('button', { name: /^Журнал/ });
}

/** Пункт переключателя видов: в одиночном режиме Radix рисует их радиокнопками. */
function view(page: Page, name: 'Проблемы' | 'События'): Locator {
  return page.getByRole('radio', { name: new RegExp(`^${name}`) });
}

/** Открывает журнал, не закрывая уже открытый: повторный щелчок по вкладке сворачивает док. */
async function openJournal(page: Page): Promise<void> {
  const tab = journalTab(page);
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute('aria-pressed')) !== 'true') await tab.click();
  await expect(view(page, 'Проблемы')).toBeVisible();
}

test.describe('Журнал', () => {
  test('нижняя панель называется «Журнал», вкладки «Проблемы» в доке больше нет', async ({
    builder,
    page,
  }) => {
    await builder.openPlayground();

    await openJournal(page);
    await expect(page.getByRole('button', { name: /^Проблемы/ })).toHaveCount(0);
    // По умолчанию — свод находок; лента — вторым видом.
    await expect(view(page, 'Проблемы')).toHaveAttribute('data-state', 'on');
    await page.screenshot({ path: path.join(SHOTS, 'problems-view.png'), fullPage: true });
  });

  test('отказ переименования: тост отсылает в журнал, запись — с именами и исключением', async ({
    builder,
    page,
    pageErrors,
  }) => {
    await builder.openPlayground();

    // Переименование в имя соседа: источник откажет «имя занято».
    await builder.treeItem('README.md').click();
    await page.keyboard.press('F2');
    const dialog = page.getByRole('dialog', { name: 'Переименовать' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').fill('package.json');
    await dialog.getByRole('textbox').press('Enter');

    await expect
      .poll(() => builder.shownNotifications())
      .toContainEqual(expect.stringContaining('Подробности — в журнале'));

    await openJournal(page);
    await view(page, 'События').click();
    const row = page.locator('[data-level="error"]').filter({
      hasText: 'Не удалось переименовать «README.md» в «package.json»',
    });
    await expect(row).toBeVisible();
    await expect(row).toContainText('reformer.files');

    // Подробности свёрнуты: строку читают по сообщению, а исключение — по требованию.
    await expect(row.locator('[data-detail]')).toHaveCount(0);
    await row.getByRole('button', { name: 'Подробности' }).click();
    await expect(row.locator('[data-detail]')).toContainText('package.json');
    await page.screenshot({ path: path.join(SHOTS, 'events-detail.png'), fullPage: true });

    // «Очистить» опустошает ленту.
    await page.getByRole('button', { name: 'Очистить' }).click();
    await expect(page.getByText('Записей нет')).toBeVisible();

    // Отказ по сценарию: плагин пишет его ещё и в консоль разработчику.
    expect(pageErrors.some((message) => message.includes('log.rename.failed'))).toBe(true);
    pageErrors.length = 0;
  });

  test('выбор вида переживает свёртку дока', async ({ builder, page }) => {
    await builder.openPlayground();
    await openJournal(page);
    await view(page, 'События').click();

    // Повторный щелчок по активной вкладке сворачивает док и снимает тело панели.
    await journalTab(page).click();
    await expect(view(page, 'События')).toBeHidden();
    await journalTab(page).click();

    await expect(view(page, 'События')).toHaveAttribute('data-state', 'on');
  });
});
