/**
 * Форма регистрации, описанная JSON-схемой ЦЕЛИКОМ.
 *
 * В .tsx примера остались только `JsonRendererProvider` и `JsonFormRenderer`, поэтому всё
 * поведение ниже приходит из JSON + реестра + TS-схемы валидации. Тесты идут по этим границам:
 * загрузка префилла (AsyncBoundary), layout, правила значений, submit-флоу, reset.
 *
 * Важно: пока идёт загрузка, форма РАЗМОНТИРОВАНА (children живут в слотах idle/ready), поэтому
 * каждый тест сперва дожидается появления полей.
 */
import { test, expect, type Page } from '@playwright/test';

const PREFILL = {
  username: 'newuser',
  email: 'new@example.com',
  fullName: 'Новый Пользователь',
  phone: '+7 (999) 111-22-33',
};

/** Дождаться, пока AsyncBoundary отдаст контент. */
async function waitForForm(page: Page): Promise<void> {
  await page.getByTestId('input-username').waitFor({ state: 'visible', timeout: 10000 });
}

/** Дозаполнить поля, которых нет в префилле. */
async function completeForm(page: Page): Promise<void> {
  await page.getByTestId('input-password').fill('Passw0rdX');
  await page.getByTestId('input-confirmPassword').fill('Passw0rdX');
  await page.getByTestId('input-captcha').fill('ABC123');
  await page.getByTestId('input-acceptTerms').click();
}

test.describe('Регистрация из JSON-схемы', () => {
  test('AsyncBoundary: префилл загружается и попадает в модель', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    for (const [field, value] of Object.entries(PREFILL)) {
      await expect(page.getByTestId(`input-${field}`)).toHaveValue(value);
    }
    // Панель состояния получает FormProxy через render-behavior (patchProps) — JSON его не выражает
    await expect(page.locator('pre')).toContainText('"username": "newuser"');
  });

  test('AsyncBoundary: пока идёт загрузка, показан индикатор, а формы нет', async ({ page }) => {
    // `?mocks=off` глушит MSW: иначе Service Worker отвечает раньше сети и page.route
    // до запроса не доходит (см. main.tsx — флаг предусмотрен ровно для этого).
    await page.route('**/registration-prefill*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PREFILL),
      });
    });
    await page.goto('/examples/registration-json?mocks=off', { waitUntil: 'commit' });

    await expect(page.getByTestId('loading-state')).toBeVisible();
    await expect(page.getByTestId('input-username')).toBeHidden();

    // …и после ответа форма появляется с загруженными значениями
    await waitForForm(page);
    await expect(page.getByTestId('loading-state')).toBeHidden();
    await expect(page.getByTestId('input-username')).toHaveValue(PREFILL.username);
  });

  test('AsyncBoundary: ошибка загрузки показывает блок ошибки с повтором', async ({ page }) => {
    // Детерминированно относительно КЛИКА «Повторить», а не числа маунтов: пока тест не разрешил
    // успех, любой запрос (включая двойной от StrictMode в dev) отдаёт 404. Тем же тестом покрыт
    // и prod-режим без двойного маунта.
    let allowSuccess = false;
    await page.route('**/registration-prefill*', async (route) => {
      if (allowSuccess) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(PREFILL),
        });
      } else {
        await route.fulfill({ status: 404, body: '' });
      }
    });
    await page.goto('/examples/registration-json?mocks=off');

    await expect(page.getByTestId('error-state')).toBeVisible();
    await expect(page.getByTestId('input-username')).toBeHidden();

    allowSuccess = true; // следующий запрос (от «Повторить») пройдёт успешно
    await page.getByRole('button', { name: 'Повторить' }).click();
    await waitForForm(page);
    await expect(page.getByTestId('input-username')).toHaveValue(PREFILL.username);
  });

  test('layout из JSON: заголовки, обе колонки, кнопки, блок подсказок', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    await expect(page.getByRole('heading', { name: 'Регистрация' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Состояние формы' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Подсказки для тестирования/ })).toBeVisible();

    for (const field of ['username', 'email', 'password', 'confirmPassword', 'captcha']) {
      await expect(page.getByTestId(`input-${field}`)).toBeVisible();
    }
    await expect(page.getByTestId('submit')).toBeVisible();
    await expect(page.getByTestId('reset')).toBeVisible();

    // Вложенный inline-контент: $html(li) с text + <code> внутри
    await expect(page.locator('li', { hasText: 'Правильная captcha' }).locator('code')).toHaveText(
      'ABC123'
    );
  });

  test('правила из TS-схемы подсвечивают незаполненное', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    await page.getByTestId('submit').click();

    await expect(page.getByTestId('error-password')).toHaveText('Пароль обязателен');
    await expect(page.getByTestId('error-captcha')).toHaveText('Введите captcha');
    await expect(page.getByTestId('error-acceptTerms')).toHaveText('Необходимо принять условия');
    // Статус живёт в сигнале реестра и рендерится текстовым узлом схемы, без useState
    await expect(page.getByTestId('submit-status')).toHaveText('Проверьте выделенные поля');
  });

  test('cross-field правило: несовпадающие пароли', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    await page.getByTestId('input-password').fill('Passw0rdX');
    await page.getByTestId('input-confirmPassword').fill('Passw0rdY');
    await page.getByTestId('submit').click();

    await expect(page.getByTestId('error-confirmPassword')).toHaveText('Пароли не совпадают');
  });

  test('behavior: правка пароля снимает устаревшую ошибку подтверждения', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    // Провоцируем ошибку «не совпадают»
    await page.getByTestId('input-password').fill('Passw0rdX');
    await page.getByTestId('input-confirmPassword').fill('Passw0rdY');
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('error-confirmPassword')).toHaveText('Пароли не совпадают');

    // onChange(password) в behavior снимает её сразу, без нового submit
    await page.getByTestId('input-password').fill('Passw0rdZ');
    await expect(page.getByTestId('error-confirmPassword')).toBeHidden();
  });

  test('async-правило: занятый username приходит с сервера', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    await completeForm(page);
    await page.getByTestId('input-username').fill('johndoe');
    await page.getByTestId('submit').click();

    // Именно узел ошибки поля, а не текст вообще: `getByText(/занят/i)` ловил бы и подсказку
    // «Занятые username: johndoe…», которая видна всегда, и тест был бы зелёным при сломанной
    // async-валидации.
    await expect(page.getByTestId('error-username')).toHaveText('Имя пользователя уже занято');
  });

  test('успешный submit сбрасывает форму к префиллу и показывает статус', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    await completeForm(page);
    await page.getByTestId('submit').click();

    await expect(page.getByTestId('submit-status')).toContainText('Регистрация успешна', {
      timeout: 10000,
    });
    // captureInitial после префилла: reset возвращает к загруженным данным, а не к пустой форме
    await expect(page.getByTestId('input-username')).toHaveValue(PREFILL.username);
    await expect(page.getByTestId('input-password')).toHaveValue('');
  });

  test('во время отправки обе кнопки заблокированы (PendingButton по ui.pending)', async ({
    page,
  }) => {
    // ?mocks=off нужен, чтобы page.route перехватывал /register — но он глушит и префилл-мок,
    // поэтому префилл тоже отдаём через route.
    await page.route('**/registration-prefill*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PREFILL),
      })
    );
    // Задерживаем POST /register, чтобы поймать состояние pending.
    await page.route('**/auth/register', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, userId: 'u-1', message: 'ok' }),
      });
    });
    await page.goto('/examples/registration-json?mocks=off');
    await waitForForm(page);

    await completeForm(page);
    await page.getByTestId('submit').click();

    // renderEffect подписан на ui.pending и дизейблит обе кнопки, пока запрос в полёте —
    // так гонка «нажал Очистить → увидел успех» исключена на уровне UI, а не только guard'ом.
    await expect(page.getByTestId('submit')).toBeDisabled();
    await expect(page.getByTestId('reset')).toBeDisabled();

    // После ответа блокировка снимается
    await expect(page.getByTestId('submit-status')).toContainText('Регистрация успешна', {
      timeout: 5000,
    });
    await expect(page.getByTestId('reset')).toBeEnabled();
  });

  test('кнопка «Очистить» возвращает значения и снимает ошибки', async ({ page }) => {
    await page.goto('/examples/registration-json');
    await waitForForm(page);

    await page.getByTestId('submit').click();
    await expect(page.getByTestId('error-captcha')).toHaveText('Введите captcha');

    await page.getByTestId('input-username').fill('temporary');
    await page.getByTestId('reset').click();

    await expect(page.getByTestId('input-username')).toHaveValue(PREFILL.username);
    await expect(page.getByTestId('error-captcha')).toBeHidden();
    await expect(page.getByTestId('submit-status')).toHaveText('');
  });
});
