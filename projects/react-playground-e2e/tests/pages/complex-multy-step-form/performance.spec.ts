/**
 * E2E-тесты производительности
 *
 * Тесты производительности формы:
 * - Время загрузки страницы
 * - Время отклика на ввод
 * - Отсутствие stack overflow
 * - Память и утечки
 */

import { test, expect } from '../../shared/test-factory';

test.describe('Производительность', { tag: ['@performance'] }, () => {
  test.describe('PERF-001: Время загрузки страницы', () => {
    test('PERF-001-A: Страница загружается менее чем за 5 секунд', async ({ creditForm }) => {
      const startTime = Date.now();

      await creditForm.goto();

      const loadTime = Date.now() - startTime;

      // Страница должна загрузиться за 5 секунд
      expect(loadTime).toBeLessThan(5000);

      // Форма должна быть интерактивной
      await expect(creditForm.nextButton).toBeEnabled();
    });

    test('PERF-001-B: Форма готова к вводу после загрузки', async ({ creditForm }) => {
      await creditForm.goto();

      // Поля должны быть доступны для ввода
      const loanAmountInput = creditForm.input('loanAmount');
      await expect(loanAmountInput).toBeEnabled();

      // Ввод должен работать сразу
      await loanAmountInput.fill('500000');
      await expect(loanAmountInput).toHaveValue('500000');
    });
  });

  test.describe('PERF-002: Отзывчивость интерфейса', () => {
    test('PERF-002-A: Ввод текста происходит без задержек', async ({ creditForm }) => {
      await creditForm.goto();

      const input = creditForm.input('loanPurpose');
      const testText = 'Это тестовый текст для проверки отзывчивости ввода';

      const startTime = Date.now();
      await input.fill(testText);
      const inputTime = Date.now() - startTime;

      // Ввод текста не должен занимать более 500ms
      expect(inputTime).toBeLessThan(500);

      await expect(input).toHaveValue(testText);
    });

    test('PERF-002-B: Переход между шагами происходит быстро', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();

      const startTime = Date.now();
      await creditForm.goToNextStep();
      const transitionTime = Date.now() - startTime;

      // Переход не должен занимать более 1 секунды
      expect(transitionTime).toBeLessThan(1000);

      await creditForm.expectStepHeading(/персональные данные/i);
    });

    test('PERF-002-C: Валидация не блокирует интерфейс', async ({ creditForm }) => {
      await creditForm.goto();

      // Вводим невалидные данные
      await creditForm.fillLoanAmount(10000);

      const startTime = Date.now();
      await creditForm.input('loanAmount').blur();
      const validationTime = Date.now() - startTime;

      // Валидация не должна занимать более 200ms
      expect(validationTime).toBeLessThan(200);
    });

    test('PERF-002-D: Вычисляемые поля обновляются быстро', async ({ creditForm }) => {
      await creditForm.goto();

      // Измеряем время пересчета
      const startTime = Date.now();
      await creditForm.fillLoanAmount(1000000);
      await creditForm.fillLoanTerm(60);
      // Ждем завершения вычислений
      await creditForm.page.waitForTimeout(100);
      const computeTime = Date.now() - startTime;

      // Вычисления не должны занимать более 500ms (включая 100ms ожидания)
      expect(computeTime).toBeLessThan(500);
    });
  });

  test.describe('PERF-003: Отсутствие stack overflow', () => {
    test('PERF-003-A: Нет stack overflow при загрузке формы', async ({ creditForm }) => {
      await creditForm.goto();

      // Проверяем отсутствие ошибок stack overflow
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    });

    test('PERF-003-B: Нет stack overflow при навигации по шагам', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      // Проверяем после прохождения всех шагов
      expect(creditForm.hasNoStackOverflow()).toBe(true);
    });

    test('PERF-003-C: Нет stack overflow при смене типа кредита', async ({ creditForm }) => {
      await creditForm.goto();

      // Многократно меняем тип кредита
      for (let i = 0; i < 10; i++) {
        await creditForm.selectLoanType('mortgage');
        await creditForm.selectLoanType('car');
        await creditForm.selectLoanType('consumer');
      }

      expect(creditForm.hasNoStackOverflow()).toBe(true);
    });

    test('PERF-003-D: Нет stack overflow при добавлении/удалении элементов массива', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      // Многократно добавляем и удаляем созаемщиков
      for (let i = 0; i < 5; i++) {
        await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      }

      for (let i = 0; i < 5; i++) {
        await creditForm.page
          .getByRole('button', { name: /удалить/i })
          .first()
          .click();
      }

      expect(creditForm.hasNoStackOverflow()).toBe(true);
    });
  });

  test.describe('PERF-004: Отсутствие console ошибок', () => {
    test('PERF-004-A: Нет ошибок в консоли при загрузке', async ({ creditForm }) => {
      await creditForm.goto();

      // Даем время на загрузку всех скриптов
      await creditForm.page.waitForTimeout(500);

      expect(creditForm.hasNoErrors()).toBe(true);
    });

    test('PERF-004-B: Нет ошибок в консоли при полном заполнении формы', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();
      await creditForm.fillSmsCode('123456');
      await creditForm.page.waitForTimeout(600);

      expect(creditForm.hasNoErrors()).toBe(true);
    });

    test('PERF-004-C: Нет ошибок при некорректных данных', async ({ creditForm }) => {
      await creditForm.goto();

      // Вводим некорректные данные
      await creditForm.fillLoanAmount(-1000);
      await creditForm.fillLoanTerm(1000);
      await creditForm.fillLoanPurpose('');

      await creditForm.goToNextStep();

      // Ошибки валидации допустимы, но не ошибки JS
      expect(creditForm.hasNoErrors()).toBe(true);
    });
  });

  test.describe('PERF-005: Производительность массивов', () => {
    test('PERF-005-A: Добавление 10 элементов не вызывает лагов', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      const startTime = Date.now();

      // Добавляем 10 созаемщиков
      for (let i = 0; i < 10; i++) {
        await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      }

      const addTime = Date.now() - startTime;

      // Добавление 10 элементов не должно занимать более 5 секунд
      expect(addTime).toBeLessThan(5000);

      // Все элементы должны быть добавлены (используем input-* для точного подсчёта)
      const coBorrowerForms = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
      await expect(coBorrowerForms).toHaveCount(10);
    });

    test('PERF-005-B: Интерфейс остается отзывчивым при большом количестве элементов', async ({
      creditForm,
    }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep4();
      await creditForm.fillStep4Employment();
      await creditForm.goToNextStep();

      await creditForm.toggleAddCoBorrower(true);

      // Добавляем 5 созаемщиков
      for (let i = 0; i < 5; i++) {
        await creditForm.page.getByRole('button', { name: /добавить созаемщика/i }).click();
      }

      // Проверяем отзывчивость ввода
      const startTime = Date.now();
      await creditForm.input('coBorrower-lastName').first().fill('Тестовая фамилия');
      const inputTime = Date.now() - startTime;

      // Ввод должен быть быстрым даже при 5 элементах
      expect(inputTime).toBeLessThan(500);
    });
  });

  test.describe('PERF-006: Асинхронные операции', () => {
    test('PERF-006-A: Асинхронная валидация SMS кода не блокирует UI', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillAndNavigateToStep6();

      await creditForm.acceptPersonalDataAgreement();
      await creditForm.acceptCreditHistoryAgreement();
      await creditForm.acceptTermsAgreement();
      await creditForm.input('confirmAccuracy').check();

      // Вводим код и сразу проверяем отзывчивость
      await creditForm.fillSmsCode('123456');

      // Пока идет асинхронная валидация, UI должен оставаться отзывчивым
      const submitButton = creditForm.submitButton;
      await expect(submitButton).toBeVisible();

      // Ждем завершения асинхронной валидации
      await creditForm.page.waitForTimeout(700);
    });

    test('PERF-006-B: Загрузка моделей авто не блокирует UI', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.selectLoanType('car');

      // Вводим марку
      await creditForm.fillCarBrand('Toyota');

      // Сразу можем продолжать заполнять другие поля
      await creditForm.fillCarYear(2023);
      await creditForm.fillCarPrice(3000000);

      // UI остается отзывчивым во время загрузки
      await expect(creditForm.input('carPrice')).toHaveValue('3000000');
    });
  });

  test.describe('PERF-007: Стабильность при длительной работе', () => {
    test('PERF-007-A: Форма стабильна при многократных переходах', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();

      // Многократно переходим между шагами
      for (let i = 0; i < 5; i++) {
        await creditForm.goToNextStep();
        await creditForm.page.waitForTimeout(100);
        await creditForm.goToPreviousStep();
        await creditForm.page.waitForTimeout(100);
      }

      // Форма должна оставаться работоспособной
      expect(creditForm.hasNoErrors()).toBe(true);
      expect(creditForm.hasNoStackOverflow()).toBe(true);

      // Данные должны сохраниться
      const loanAmount = await creditForm.input('loanAmount').inputValue();
      expect(loanAmount).toBe('500000');
    });

    test('PERF-007-B: Форма стабильна при быстром вводе', async ({ creditForm }) => {
      await creditForm.goto();
      await creditForm.fillStep1ConsumerLoan();
      await creditForm.goToNextStep();

      // Быстро заполняем множество полей
      await creditForm.fillLastName('Быстров');
      await creditForm.fillFirstName('Быстрый');
      await creditForm.fillMiddleName('Быстрович');
      await creditForm.fillBirthDate('1990-01-01');
      await creditForm.selectGender('male');
      await creditForm.fillBirthPlace('Быстрый город');
      await creditForm.fillPassportSeries('45 06');
      await creditForm.fillPassportNumber('123456');
      await creditForm.fillPassportIssuedBy('Быстрое ОВД быстрого района');
      await creditForm.fillPassportIssuedDate('2010-01-01');
      await creditForm.fillPassportCode('770-001');
      await creditForm.fillInn('123456789012');
      await creditForm.fillSnils('123-456-789 01');

      // Форма должна корректно обработать все вводы
      expect(creditForm.hasNoErrors()).toBe(true);

      // Данные должны быть сохранены
      await expect(creditForm.input('personalData-lastName')).toHaveValue('Быстров');
    });

    test('PERF-007-C: Форма корректно работает после очистки и повторного заполнения', async ({
      creditForm,
    }) => {
      await creditForm.goto();

      // Первое заполнение
      await creditForm.fillLoanAmount(500000);
      await creditForm.fillLoanTerm(24);
      await creditForm.fillLoanPurpose('Первая цель кредита');

      // Очистка
      await creditForm.input('loanAmount').clear();
      await creditForm.input('loanTerm').clear();
      await creditForm.input('loanPurpose').clear();

      // Повторное заполнение
      await creditForm.fillLoanAmount(1000000);
      await creditForm.fillLoanTerm(60);
      await creditForm.fillLoanPurpose('Вторая цель кредита');

      // Данные должны быть корректными
      await expect(creditForm.input('loanAmount')).toHaveValue('1000000');
      await expect(creditForm.input('loanTerm')).toHaveValue('60');
      await expect(creditForm.input('loanPurpose')).toHaveValue('Вторая цель кредита');

      expect(creditForm.hasNoErrors()).toBe(true);
    });
  });
});
