/**
 * Форма регистрации, собранная из JSON-схемы.
 *
 * Проверяется то, что разъехалось по трём файлам и могло бы разойтись по смыслу:
 * layout (json-schema.json), правила значений (validation.ts) и обработчики (registry.ts).
 * Поэтому тесты идут по границам: рендер layout'а → валидация → submit-флоу → reset.
 */
import { test, expect } from '@playwright/test';

const VALID = {
  username: 'newuser42',
  email: 'new@example.com',
  password: 'Passw0rdX',
  confirmPassword: 'Passw0rdX',
  fullName: 'Иван Иванов',
  phone: '+7 (999) 123-45-67',
  captcha: 'ABC123',
};

async function fillValid(page: import('@playwright/test').Page): Promise<void> {
  for (const [field, value] of Object.entries(VALID)) {
    await page.getByTestId(`input-${field}`).fill(value);
  }
  await page.getByTestId('input-acceptTerms').click();
}

test.describe('Регистрация из JSON-схемы', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/registration-json');
  });

  test('layout из JSON отрисован: заголовки, сетка полей, кнопки, блок подсказок', async ({
    page,
  }) => {
    // Заголовки и текст — $html-узлы, а не зарегистрированные компоненты
    await expect(page.getByRole('heading', { name: 'Регистрация' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Подсказки для тестирования/ })).toBeVisible();

    // Все восемь полей на месте
    for (const field of [...Object.keys(VALID), 'acceptTerms']) {
      await expect(page.getByTestId(`input-${field}`)).toBeVisible();
    }

    // Кнопки — компоненты реестра с обработчиками через $fn
    await expect(page.getByTestId('submit')).toBeVisible();
    await expect(page.getByTestId('reset')).toBeVisible();

    // Список подсказок — вложенные $html(li) с inline <code>
    await expect(page.locator('li', { hasText: 'Правильная captcha' }).locator('code')).toHaveText(
      'ABC123'
    );
  });

  test('пустая отправка подсвечивает поля — правила приходят из TS-схемы, не из JSON', async ({
    page,
  }) => {
    await page.getByTestId('submit').click();

    await expect(page.getByText('Имя пользователя обязательно')).toBeVisible();
    await expect(page.getByText('Email обязателен')).toBeVisible();
    await expect(page.getByText('Необходимо принять условия')).toBeVisible();
    await expect(page.getByTestId('submit-status')).toHaveText('Проверьте выделенные поля');
  });

  test('cross-field правило: несовпадающие пароли', async ({ page }) => {
    await page.getByTestId('input-password').fill('Passw0rdX');
    await page.getByTestId('input-confirmPassword').fill('Passw0rdY');
    await page.getByTestId('submit').click();

    await expect(page.getByText('Пароли не совпадают')).toBeVisible();
  });

  test('async-правило: занятый username приходит с сервера', async ({ page }) => {
    await fillValid(page);
    await page.getByTestId('input-username').fill('johndoe');
    await page.getByTestId('submit').click();

    await expect(page.getByText(/занят/i).first()).toBeVisible();
  });

  test('успешный submit сбрасывает форму и показывает статус', async ({ page }) => {
    await fillValid(page);
    await page.getByTestId('submit').click();

    await expect(page.getByTestId('submit-status')).toContainText('Регистрация успешна', {
      timeout: 10000,
    });
    // reset после успеха — поля возвращаются к initial-снимку
    await expect(page.getByTestId('input-username')).toHaveValue('');
    await expect(page.getByTestId('input-email')).toHaveValue('');
  });

  test('кнопка «Очистить» возвращает значения и снимает ошибки', async ({ page }) => {
    await page.getByTestId('submit').click();
    await expect(page.getByText('Email обязателен')).toBeVisible();

    await page.getByTestId('input-username').fill('temporary');
    await page.getByTestId('reset').click();

    await expect(page.getByTestId('input-username')).toHaveValue('');
    await expect(page.getByText('Email обязателен')).toBeHidden();
  });
});
