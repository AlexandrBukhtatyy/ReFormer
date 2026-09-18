import { test, expect, type Page } from '@playwright/test';

/**
 * E2E Input с подсказками (`InputField` + `suggestions`). Главный инвариант: значение — всегда
 * введённый текст; подсказка лишь подставляет свой `value`, а свой вариант не теряется.
 */
const SCREENSHOTS = 'screenshots/input-suggest';

const input = (page: Page, testId: string) => page.locator(`[data-testid="input-${testId}"]`);
const listbox = (page: Page) => page.getByRole('listbox');
const option = (page: Page, name: string) => page.getByRole('option', { name, exact: true });

async function modelSnapshot(page: Page): Promise<Record<string, string | null>> {
  await page.getByTestId('snapshot').click();
  return JSON.parse((await page.getByTestId('snapshot-output').textContent()) ?? '{}');
}

test.describe('Input с подсказками', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/input-suggest');
  });

  test('свободный текст остаётся значением, список фильтруется по вводу', async ({ page }) => {
    const city = input(page, 'city');
    await expect(city).toHaveAttribute('role', 'combobox');
    await city.fill('Му');
    await expect(listbox(page)).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(option(page, 'Мурманск')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/filtered.png`, fullPage: true });

    await city.fill('Мухосранск-на-Дону');
    await expect(listbox(page)).toBeHidden();
    await city.blur();
    expect((await modelSnapshot(page)).city).toBe('Мухосранск-на-Дону');
  });

  test('клик по подсказке подставляет value, фокус остаётся в поле', async ({ page }) => {
    const city = input(page, 'city');
    await city.fill('ка');
    await option(page, 'Казань').click();
    await expect(city).toHaveValue('Казань');
    await expect(city).toBeFocused();
    await expect(listbox(page)).toBeHidden();
    expect((await modelSnapshot(page)).city).toBe('Казань');
  });

  test('клавиатура: ↓/↑ подсвечивают, Enter выбирает, Esc закрывает', async ({ page }) => {
    const city = input(page, 'city');
    await city.fill('Н');
    await city.press('ArrowDown');
    const first = page.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(city).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
    await city.press('ArrowUp'); // циклически на последнюю
    await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
    const lastValue = await page.getByRole('option').last().textContent();
    await city.press('Enter');
    await expect(city).toHaveValue(lastValue!);

    await city.fill('Мо');
    await expect(listbox(page)).toBeVisible();
    await city.press('Escape');
    await expect(listbox(page)).toBeHidden();
    await expect(city).toHaveValue('Мо');
  });

  test('value ≠ label: в поле уходит value; openOnFocus раскрывает список сразу', async ({
    page,
  }) => {
    const position = input(page, 'position');
    await position.focus();
    await expect(listbox(page)).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(4);
    await option(page, 'Frontend-разработчик (React, TypeScript)').click();
    await expect(position).toHaveValue('Frontend-разработчик');
    expect((await modelSnapshot(page)).position).toBe('Frontend-разработчик');
  });

  test('очистка поля даёт null', async ({ page }) => {
    const city = input(page, 'city');
    await city.fill('abc');
    await city.fill('');
    await city.blur();
    expect((await modelSnapshot(page)).city).toBeNull();
  });

  test('серверный поиск: minChars, загрузка, выбор', async ({ page }) => {
    const company = input(page, 'company');
    await company.fill('Р');
    await page.waitForTimeout(900);
    await expect(listbox(page)).toBeHidden();

    await company.fill('Ро');
    await expect(option(page, 'Ромашка')).toBeVisible();
    await expect(option(page, 'Компания 1')).toHaveCount(0);
    await page.screenshot({ path: `${SCREENSHOTS}/server-search.png`, fullPage: true });
    await option(page, 'Роснефтегаз').click();
    await expect(company).toHaveValue('Роснефтегаз');
  });

  test('серверный поиск: догрузка страницы при скролле', async ({ page }) => {
    const company = input(page, 'company');
    await company.fill('Компания');
    await expect(page.getByRole('option')).toHaveCount(10);
    await listbox(page).evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(page.getByRole('option')).toHaveCount(20);
  });
});
