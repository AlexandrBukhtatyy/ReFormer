/**
 * E2E-тесты состояний загрузки и ошибок
 * Проверяют хук useLoadCreditApplication: спиннер, пред-заполнение, ошибка, повтор
 *
 * @tag @regression
 */

import { test, expect } from '../../shared/test-factory';
import {
  mockCreditApplicationApi,
  mockDictionariesApi,
  mockRegionsApi,
  mockCitiesApi,
  mockCarModelsApi,
  mockSubmitApplicationApi,
} from './mocks';

test.describe('Состояния загрузки и ошибок', { tag: ['@regression'] }, () => {
  // -------------------------------------------------------------------------
  // LOAD-001: Состояние загрузки
  // -------------------------------------------------------------------------

  test.describe('LOAD-001: Состояние загрузки', () => {
    test('LOAD-001-A: форма показывает индикатор загрузки пока идёт запрос', async ({
      page,
      creditForm,
    }) => {
      // Мокируем с длительной задержкой — чтобы поймать состояние загрузки
      await mockCreditApplicationApi(page, { delay: 3000 });
      await mockDictionariesApi(page, { delay: 100 });
      await mockRegionsApi(page, { delay: 100 });
      await mockCitiesApi(page, { delay: 100 });
      await mockCarModelsApi(page, { delay: 100 });

      await page.goto(creditForm.basePath);

      // Индикатор загрузки должен быть виден сразу после перехода
      await expect(page.locator('[data-testid="loading-state"]')).toBeVisible({ timeout: 2000 });
    });

    test('LOAD-001-B: форма заполняется данными из API после загрузки (applicationId=1)', async ({
      page,
      creditForm,
    }) => {
      // MOCK_CREDIT_APPLICATION_1: потребительский 500k/24мес, Иванов employed
      await mockCreditApplicationApi(page, { delay: 100 });
      await mockDictionariesApi(page, { delay: 50 });
      await mockRegionsApi(page, { delay: 50 });
      await mockCitiesApi(page, { delay: 50 });
      await mockCarModelsApi(page, { delay: 50 });
      await mockSubmitApplicationApi(page, { delay: 50 });

      await creditForm.goto();

      // Проверяем что поля заполнены данными из мока
      await expect(creditForm.input('loanAmount')).toHaveValue('500000');
      await expect(creditForm.input('loanTerm')).toHaveValue('24');
    });
  });

  // -------------------------------------------------------------------------
  // LOAD-002: Состояние ошибки
  // -------------------------------------------------------------------------

  test.describe('LOAD-002: Состояние ошибки', () => {
    test('LOAD-002-A: при ошибке API отображается компонент ErrorState', async ({
      page,
      creditForm,
    }) => {
      // Мокируем ошибку сервера при загрузке заявки
      await mockCreditApplicationApi(page, { simulateError: true, errorStatus: 500 });
      await mockDictionariesApi(page, { delay: 50 });
      await mockRegionsApi(page, { delay: 50 });
      await mockCitiesApi(page, { delay: 50 });

      await page.goto(creditForm.basePath);
      await page.waitForLoadState('networkidle');

      await creditForm.expectErrorState();
    });

    test('LOAD-002-B: кнопка "Повторить" перезагружает страницу', async ({ page, creditForm }) => {
      // Первый запрос — ошибка, второй — успех
      let requestCount = 0;
      await page.route('**/api/v1/credit-applications/**', async (route) => {
        requestCount++;
        if (requestCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal Server Error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              loanType: 'consumer',
              loanAmount: 100000,
              loanTerm: 12,
              loanPurpose: 'Тест',
            }),
          });
        }
      });
      await mockDictionariesApi(page, { delay: 50 });
      await mockRegionsApi(page, { delay: 50 });
      await mockCitiesApi(page, { delay: 50 });

      await page.goto(creditForm.basePath);
      await page.waitForLoadState('networkidle');

      // Дожидаемся ErrorState и жмём Повторить
      const retryButton = page.locator('button:has-text("Повторить"), button:has-text("Retry")');
      await expect(retryButton).toBeVisible({ timeout: 10000 });

      // Отслеживаем перезагрузку страницы
      const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
      await retryButton.click();
      await navigationPromise;

      // После перезагрузки страница должна снова попытаться загрузиться
      expect(requestCount).toBeGreaterThan(1);
    });
  });
});
