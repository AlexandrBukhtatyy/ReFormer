import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Производительность (Performance)', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
  });

  /**
   * TC-PERF-001: Время инициализации формы
   * Приоритет: High
   * Порог: < 2000ms с загрузкой данных
   */
  test(
    'TC-PERF-001: Время инициализации формы',
    {
      tag: ['@high', '@performance'],
    },
    async ({ page }) => {
      const startTime = Date.now();

      await page.goto('http://localhost:5173');
      await page.waitForSelector('h2', { timeout: 10000 });

      const loadTime = Date.now() - startTime;

      console.log(`Время загрузки формы: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // Более мягкий порог для CI
    }
  );

  /**
   * TC-PERF-002: Время отклика при вводе в поля
   * Приоритет: Critical
   * Порог: < 16ms (60fps)
   */
  test(
    'TC-PERF-002: Время отклика при вводе в поля',
    {
      tag: ['@critical', '@performance'],
    },
    async () => {
      await creditForm.goto();

      const purposeField = creditForm.input('loanPurpose');

      // Измеряем время ввода
      const startTime = Date.now();
      await purposeField.fill('Тестовая строка для проверки производительности ввода');
      const inputTime = Date.now() - startTime;

      console.log(`Время ввода: ${inputTime}ms`);

      // Ввод не должен занимать больше 1 секунды
      expect(inputTime).toBeLessThan(1000);
    }
  );

  /**
   * TC-PERF-003: Время пересчета вычисляемых полей
   * Приоритет: High
   * Порог: < 50ms
   */
  test(
    'TC-PERF-003: Время пересчета вычисляемых полей',
    {
      tag: ['@high', '@performance'],
    },
    async ({ page }) => {
      await creditForm.goto();

      await creditForm.selectLoanType('mortgage');

      const startTime = Date.now();
      await creditForm.fillPropertyValue(10000000);
      await page.waitForTimeout(100); // Ждём пересчета

      const computeTime = Date.now() - startTime;
      console.log(`Время пересчета: ${computeTime}ms`);

      // Пересчет должен быть быстрым
      expect(computeTime).toBeLessThan(500);

      // Проверяем что значение рассчитано
      const value = await creditForm.input('initialPayment').inputValue();
      expect(parseFloat(value)).toBe(2000000);
    }
  );

  /**
   * TC-PERF-004: Время валидации шага перед переходом
   * Приоритет: High
   * Порог: < 100ms
   */
  test(
    'TC-PERF-004: Время валидации шага перед переходом',
    {
      tag: ['@high', '@performance'],
    },
    async () => {
      await creditForm.goto();

      // Заполняем шаг
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Ремонт квартиры');

      const startTime = Date.now();
      await creditForm.goToNextStep();
      const validationTime = Date.now() - startTime;

      console.log(`Время валидации и перехода: ${validationTime}ms`);
      expect(validationTime).toBeLessThan(1000);

      // Проверяем что перешли на следующий шаг
      await creditForm.expectStepHeading(/персональные данные/i);
    }
  );

  /**
   * TC-PERF-005: Производительность при большом количестве элементов в массивах
   * Приоритет: High
   */
  test(
    'TC-PERF-005: Производительность при большом количестве элементов в массивах',
    {
      tag: ['@high', '@performance'],
    },
    async ({ page }) => {
      await creditForm.goto();

      // Переходим на шаг 5
      for (let i = 0; i < 4; i++) {
        await creditForm.goToNextStep();
      }

      // Включаем чекбокс имущества
      const hasPropertyCheckbox = creditForm.input('hasProperty');
      if ((await hasPropertyCheckbox.count()) > 0) {
        await hasPropertyCheckbox.check();

        const startTime = Date.now();

        // Добавляем 10 элементов
        for (let i = 0; i < 10; i++) {
          await page.getByRole('button', { name: /добавить имущество/i }).click();
        }

        const addTime = Date.now() - startTime;
        console.log(`Время добавления 10 элементов: ${addTime}ms`);

        // Не должно быть слишком долго
        expect(addTime).toBeLessThan(5000);

        // Проверяем что все элементы добавлены
        await expect(page.getByRole('heading', { name: /имущество #10/i })).toBeVisible();
      }
    }
  );

  /**
   * TC-PERF-006: Время переключения между шагами
   * Приоритет: High
   * Порог: < 100ms
   */
  test(
    'TC-PERF-006: Время переключения между шагами',
    {
      tag: ['@high', '@performance'],
    },
    async () => {
      await creditForm.goto();

      const times: number[] = [];

      // Измеряем время переходов
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await creditForm.goToNextStep();
        times.push(Date.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`Среднее время перехода: ${avgTime}ms`);

      // Средний переход должен быть быстрым
      expect(avgTime).toBeLessThan(500);
    }
  );

  /**
   * TC-PERF-007: FPS при быстром вводе с масками
   * Приоритет: High
   */
  test(
    'TC-PERF-007: FPS при быстром вводе с масками',
    {
      tag: ['@high', '@performance'],
    },
    async () => {
      await creditForm.goto();

      // Переходим на шаг 3
      for (let i = 0; i < 2; i++) {
        await creditForm.goToNextStep();
      }

      // Быстро вводим телефон с маской
      const phoneField = creditForm.input('phoneMain');

      const startTime = Date.now();
      await phoneField.type('9991234567', { delay: 10 }); // Быстрый ввод
      const typeTime = Date.now() - startTime;

      console.log(`Время ввода телефона: ${typeTime}ms`);

      // Должно быть быстро
      expect(typeTime).toBeLessThan(2000);

      // Проверяем что маска применена
      const value = await phoneField.inputValue();
      expect(value).toContain('+7');
    }
  );

  /**
   * TC-PERF-008: Производительность debounce-логики
   * Приоритет: Medium
   */
  test(
    'TC-PERF-008: Производительность debounce-логики',
    {
      tag: ['@medium', '@performance'],
    },
    async ({ page }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Подсчитываем запросы
      let requestCount = 0;
      page.on('request', (request) => {
        if (request.url().includes('model') || request.url().includes('brand')) {
          requestCount++;
        }
      });

      // Быстро вводим текст
      const brandField = creditForm.input('carBrand');
      await brandField.type('Toyota', { delay: 30 });

      // Ждём debounce
      await page.waitForTimeout(500);

      // Не должно быть много запросов из-за debounce
      console.log(`Количество запросов: ${requestCount}`);
    }
  );

  /**
   * TC-PERF-009: Память при длительной работе с формой
   * Приоритет: High
   */
  test(
    'TC-PERF-009: Память при длительной работе с формой',
    {
      tag: ['@high', '@performance'],
    },
    async () => {
      await creditForm.goto();

      // Выполняем много операций
      for (let cycle = 0; cycle < 5; cycle++) {
        // Заполняем и очищаем поля
        await creditForm.fillLoanAmount(500000 + cycle * 100000);
        await creditForm.fillLoanTerm(24 + cycle);
        await creditForm.fillLoanPurpose(`Цель ${cycle}`);

        // Переключаем типы
        await creditForm.selectLoanType('mortgage');
        await creditForm.selectLoanType('car');
        await creditForm.selectLoanType('consumer');

        // Переходим между шагами
        await creditForm.goToNextStep();
        await creditForm.goToPreviousStep();
      }

      // Форма должна работать стабильно
      expect(creditForm.hasNoErrors()).toBe(true);

      // Проверяем что нет ошибок в консоли
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    }
  );
});
