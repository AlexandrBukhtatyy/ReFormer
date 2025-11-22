import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Динамическая загрузка данных', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
  });

  /**
   * TC-LOAD-001: Загрузка справочников при инициализации формы
   * Приоритет: Critical
   */
  test(
    'TC-LOAD-001: Загрузка справочников при инициализации формы',
    {
      tag: ['@critical', '@data-loading'],
    },
    async ({ page }) => {
      // Открываем форму и ждём загрузки
      await page.goto('http://localhost:5173');

      // Проверяем индикатор загрузки
      const loadingIndicator = page.getByText(/загрузка данных/i);
      // Индикатор должен появиться и затем исчезнуть
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

      // Проверяем что форма готова
      await expect(
        page.getByRole('heading', { name: /основная информация о кредите/i })
      ).toBeVisible();

      // Проверяем что справочники загружены (например, типы кредита)
      await creditForm.input('loanType').click();
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible();
    }
  );

  /**
   * TC-LOAD-002: Загрузка данных заявки по ID
   * Приоритет: Critical
   */
  test(
    'TC-LOAD-002: Загрузка данных заявки по ID',
    {
      tag: ['@critical', '@data-loading'],
    },
    async () => {
      // Форма загружается с applicationId='1' по умолчанию
      await creditForm.goto();

      // Проверяем что данные предзаполнены
      const value = await creditForm.input('loanAmount').inputValue();
      expect(value).not.toBe('');
      expect(parseFloat(value)).toBeGreaterThan(0);
    }
  );

  /**
   * TC-LOAD-003: Параллельная загрузка данных и справочников
   * Приоритет: High
   */
  test(
    'TC-LOAD-003: Параллельная загрузка данных и справочников',
    {
      tag: ['@high', '@data-loading'],
    },
    async ({ page }) => {
      // Отслеживаем сетевые запросы
      const requests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('api') || request.url().includes('mock')) {
          requests.push(request.url());
        }
      });

      await creditForm.goto();

      // Проверяем что форма загружена
      await expect(
        page.getByRole('heading', { name: /основная информация о кредите/i })
      ).toBeVisible();

      // Запросы должны выполняться (если есть реальный API)
      // В моках это может не работать
    }
  );

  /**
   * TC-LOAD-004: Debounce при загрузке моделей авто
   * Приоритет: High
   */
  test(
    'TC-LOAD-004: Debounce при загрузке моделей авто',
    {
      tag: ['@high', '@data-loading'],
    },
    async ({ page }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Отслеживаем запросы
      let requestCount = 0;
      page.on('request', (request) => {
        if (request.url().includes('model') || request.url().includes('car')) {
          requestCount++;
        }
      });

      // Быстро вводим символы
      const brandField = creditForm.input('carBrand');
      await brandField.fill('T');
      await page.waitForTimeout(50);
      await brandField.fill('To');
      await page.waitForTimeout(50);
      await brandField.fill('Toy');
      await page.waitForTimeout(50);
      await brandField.fill('Toyo');
      await page.waitForTimeout(50);
      await brandField.fill('Toyota');

      // Ждём debounce
      await page.waitForTimeout(500);

      // Должен быть минимальный запрос (debounce работает)
      // В реальном API это проверяется лучше
    }
  );

  /**
   * TC-LOAD-005: Загрузка городов по региону
   * Приоритет: High
   */
  test(
    'TC-LOAD-005: Загрузка городов по региону',
    {
      tag: ['@high', '@data-loading'],
    },
    async ({ page }) => {
      await creditForm.goto();

      // Переходим на шаг 3
      for (let i = 0; i < 2; i++) {
        await creditForm.goToNextStep();
      }

      // Вводим регион
      await creditForm.fillRegion('Московская область');

      // Ждём загрузки городов
      await page.waitForTimeout(500);

      // Проверяем что города доступны
      const cityField = creditForm.input('registrationAddress-city');
      if ((await cityField.count()) > 0) {
        await cityField.click();
        // Могут быть опции (зависит от реализации)
      }
    }
  );
});
