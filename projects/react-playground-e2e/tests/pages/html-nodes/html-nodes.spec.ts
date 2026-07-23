/**
 * Smoke-проверка HTML-узлов: обе колонки примера рендерят нативные теги и реактивный текст.
 *
 * Ключевая проверка — реактивность: ввод в поле должен обновить текст сводки, собранный
 * узлом `text` из сигналов модели (`model.$.fullName` / `"$model(fullName)"`).
 */
import { test, expect } from '@playwright/test';

test.describe('HTML-узлы в схеме', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/html-nodes');
  });

  test('обе колонки рендерят нативные теги вместо зарегистрированных компонентов', async ({
    page,
  }) => {
    const typed = page.getByTestId('typed-schema');
    const json = page.getByTestId('json-schema');

    // Заголовок из `text` (в JSON-колонке — через $locale)
    await expect(typed.locator('h2')).toHaveText('Рассрочка');
    await expect(json.locator('h2')).toHaveText('Рассрочка');

    // text + children в одном узле: «Проценты не начисляются. <b>Досрочное…</b>»
    await expect(typed.locator('p')).toContainText('Проценты не начисляются.');
    await expect(typed.locator('p b')).toHaveText('Досрочное погашение бесплатно.');
    await expect(json.locator('p b')).toHaveText('Досрочное погашение бесплатно.');

    // void-тег отрисован и не сломал рендер
    await expect(typed.locator('hr')).toBeVisible();
    await expect(json.locator('hr')).toBeVisible();

    // selector/служебные поля не утекли в разметку
    await expect(typed.locator('[selector]')).toHaveCount(0);
  });

  test('реактивный text обновляется при вводе — типизованная схема', async ({ page }) => {
    const typed = page.getByTestId('typed-schema');
    await expect(typed.getByTestId('summary-fullName')).toHaveText('');

    await typed.getByTestId('input-fullName').fill('Иванов Иван');
    await expect(typed.getByTestId('summary-fullName')).toHaveText('Иванов Иван');

    // Вычисляемый сигнал в text: 60000 / 12 = 5000
    await expect(typed.getByTestId('summary-monthly')).toHaveText('5000 ₽');
    await typed.getByTestId('input-months').fill('6');
    await expect(typed.getByTestId('summary-monthly')).toHaveText('10000 ₽');
  });

  test('реактивный text обновляется при вводе — JSON-схема', async ({ page }) => {
    const json = page.getByTestId('json-schema');
    await json.getByTestId('input-fullName').fill('Петров Пётр');
    await expect(json.getByTestId('summary-fullName')).toHaveText('Петров Пётр');

    // Массив частей: "$model(amount)" + " ₽ на " + "$model(months)" + " мес."
    await expect(json.getByTestId('summary-amount')).toHaveText('60000 ₽ на 12 мес.');
    await json.getByTestId('input-amount').fill('90000');
    await expect(json.getByTestId('summary-amount')).toHaveText('90000 ₽ на 12 мес.');
  });

  test('колонки изолированы — ввод слева не меняет сводку справа', async ({ page }) => {
    await page.getByTestId('typed-schema').getByTestId('input-fullName').fill('Только слева');
    await expect(page.getByTestId('json-schema').getByTestId('summary-fullName')).toHaveText('');
  });
});
