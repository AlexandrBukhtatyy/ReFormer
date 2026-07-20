/**
 * E2E: императивные handle полей UI-kit, доступные из render-схемы по селектору.
 *
 * Это ПОВЕДЕНЧЕСКОЕ доказательство моста «селектор → живой компонент»: unit-тесты в репозитории
 * идут без DOM (SSR/чистая логика), поэтому реальные focus/open/toggle проверяются только здесь.
 *
 * Покрывает:
 *  - baseline FieldHandle.focus() у Input (адресация по `__path` сигнала) и у number-варианта;
 *  - rich InputPasswordHandle.toggleVisibility() (адресация по явному `selector`);
 *  - rich SelectAsyncHandle.open()/close()/clear() (контролируемый `open` в Radix Root);
 *  - сценарий «сфокусировать первое невалидное поле» через пути из validateFormModel().errors.
 *
 * @tag @imperative-handles
 */

import { test, expect } from '../../shared/test-factory';

const PAGE_PATH = '/examples/imperative-handles';

test.describe('Императивные handle по селектору', { tag: ['@imperative-handles'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_PATH);
    // Форма отрисована — поля на месте.
    await expect(page.getByTestId('input-email')).toBeVisible();
  });

  test('IMP-001: baseline focus() у Input по __path сигнала', async ({ page }) => {
    const email = page.getByTestId('input-email');
    await expect(email).not.toBeFocused();

    await page.getByTestId('btn-focus-email').click();

    await expect(email).toBeFocused();
  });

  test('IMP-002: baseline focus() у number-варианта (InputNumberField)', async ({ page }) => {
    const amount = page.getByTestId('input-amount');

    await page.getByTestId('btn-focus-amount').click();

    await expect(amount).toBeFocused();
  });

  test('IMP-003: InputPasswordHandle.toggleVisibility() по явному selector', async ({ page }) => {
    const password = page.getByTestId('input-password');
    // Печатаем значение: тумблер видимости у InputPassword появляется только при непустом value,
    // но императивный handle должен работать независимо от наличия кнопки-тумблера.
    await password.fill('secret123');
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByTestId('btn-toggle-password').click();
    await expect(password).toHaveAttribute('type', 'text');

    await page.getByTestId('btn-toggle-password').click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('IMP-004: SelectAsyncHandle.open()/close() управляет дропдауном', async ({ page }) => {
    const option = page.getByRole('option', { name: 'Москва' });
    await expect(option).toHaveCount(0);

    await page.getByTestId('btn-open-city').click();
    await expect(option).toBeVisible();

    // Открытый Radix Select — модальный: он гасит pointer-events вне дропдауна, поэтому обычный
    // click по внешней кнопке не доходит. Диспатчим событие напрямую — проверяем именно наш
    // close(), а не способность кликнуть сквозь оверлей.
    await page.getByTestId('btn-close-city').dispatchEvent('click');
    await expect(option).toHaveCount(0);
  });

  test('IMP-005: SelectAsyncHandle.clear() сбрасывает выбранное значение', async ({ page }) => {
    // Выбираем город обычным пользовательским путём.
    await page.getByTestId('btn-open-city').click();
    await page.getByRole('option', { name: 'Москва' }).click();
    await expect(page.getByTestId('input-city')).toContainText('Москва');

    await page.getByTestId('btn-clear-city').click();

    await expect(page.getByTestId('input-city')).not.toContainText('Москва');
  });

  test('IMP-006: focus первого невалидного поля по путям из validateFormModel', async ({
    page,
  }) => {
    // email пуст → первый невалидный. nickname тоже required, но идёт позже.
    await page.getByTestId('btn-focus-first-invalid').click();

    await expect(page.getByTestId('input-email')).toBeFocused();

    // Заполняем email → первым невалидным становится nickname (адресация по __path).
    await page.getByTestId('input-email').fill('user@example.com');
    await page.getByTestId('btn-focus-first-invalid').click();

    await expect(page.getByTestId('input-nickname')).toBeFocused();
  });
});
