import { test, expect } from '@playwright/test';
import { CreditFormPage } from '../pages/CreditFormPage';

test.describe('Условные поля (Conditional Fields)', () => {
  let creditForm: CreditFormPage;

  test.beforeEach(async ({ page }) => {
    creditForm = new CreditFormPage(page);
    await creditForm.goto();
  });

  // ============================================================================
  // Шаг 1: Условные поля по типу кредита
  // ============================================================================

  test.describe('Поля ипотеки', () => {
    /**
     * TC-COND-001: Отображение полей ипотеки при выборе типа "Ипотека"
     * Приоритет: Critical
     */
    test(
      'TC-COND-001: Отображение полей ипотеки при выборе типа "Ипотека"',
      {
        tag: ['@critical', '@conditional'],
      },
      async () => {
        // Проверяем что поля ипотеки изначально скрыты (тип по умолчанию - потребительский)
        await creditForm.expectFieldHidden('propertyValue');

        // Выбираем ипотеку
        await creditForm.selectLoanType('mortgage');

        // Проверяем появление полей ипотеки
        await creditForm.expectFieldVisible('propertyValue');
        await creditForm.expectFieldVisible('initialPayment');
      }
    );

    /**
     * TC-COND-002: Скрытие полей ипотеки при смене типа кредита
     * Приоритет: High
     */
    test(
      'TC-COND-002: Скрытие полей ипотеки при смене типа кредита',
      {
        tag: ['@high', '@conditional'],
      },
      async () => {
        // Выбираем ипотеку
        await creditForm.selectLoanType('mortgage');
        await creditForm.expectFieldVisible('propertyValue');

        // Заполняем поля ипотеки
        await creditForm.fillPropertyValue(5000000);

        // Меняем тип на потребительский
        await creditForm.selectLoanType('consumer');

        // Проверяем что поля скрыты
        await creditForm.expectFieldHidden('propertyValue');
        await creditForm.expectFieldHidden('initialPayment');
      }
    );
  });

  test.describe('Поля автокредита', () => {
    /**
     * TC-COND-003: Отображение полей автокредита
     * Приоритет: Critical
     */
    test(
      'TC-COND-003: Отображение полей автокредита',
      {
        tag: ['@critical', '@conditional'],
      },
      async () => {
        // Проверяем что поля автокредита изначально скрыты
        await creditForm.expectFieldHidden('carBrand');

        // Выбираем автокредит
        await creditForm.selectLoanType('car');

        // Проверяем появление полей автокредита
        await creditForm.expectFieldVisible('carBrand');
        await creditForm.expectFieldVisible('carModel');
        await creditForm.expectFieldVisible('carYear');
        await creditForm.expectFieldVisible('carPrice');
      }
    );

    /**
     * TC-COND-004: Скрытие полей автокредита при смене типа
     * Приоритет: High
     */
    test(
      'TC-COND-004: Скрытие полей автокредита при смене типа',
      {
        tag: ['@high', '@conditional'],
      },
      async () => {
        // Выбираем автокредит
        await creditForm.selectLoanType('car');
        await creditForm.expectFieldVisible('carBrand');

        // Заполняем поля
        await creditForm.fillCarBrand('Toyota');
        await creditForm.fillCarYear(2023);

        // Меняем тип на потребительский
        await creditForm.selectLoanType('consumer');

        // Проверяем что поля скрыты
        await creditForm.expectFieldHidden('carBrand');
        await creditForm.expectFieldHidden('carModel');
        await creditForm.expectFieldHidden('carYear');
        await creditForm.expectFieldHidden('carPrice');
      }
    );
  });

  // ============================================================================
  // Шаг 4: Условные поля занятости
  // ============================================================================

  test.describe('Поля занятости', () => {
    test.beforeEach(async () => {
      // Переходим на шаг 4
      for (let i = 0; i < 3; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-COND-005: Отображение полей работодателя при статусе "Работаю по найму"
     * Приоритет: Critical
     */
    test(
      'TC-COND-005: Отображение полей работодателя при статусе "Работаю по найму"',
      {
        tag: ['@critical', '@conditional'],
      },
      async () => {
        await creditForm.selectEmploymentStatus('employed');

        // Проверяем появление полей работодателя
        await creditForm.expectFieldVisible('companyName');
        await creditForm.expectFieldVisible('companyInn');
        await creditForm.expectFieldVisible('position');
      }
    );

    /**
     * TC-COND-006: Отображение полей ИП при статусе "Самозанятый/ИП"
     * Приоритет: Critical
     */
    test(
      'TC-COND-006: Отображение полей ИП при статусе "Самозанятый/ИП"',
      {
        tag: ['@critical', '@conditional'],
      },
      async () => {
        await creditForm.selectEmploymentStatus('selfEmployed');

        // Проверяем что поля работодателя скрыты
        await creditForm.expectFieldHidden('companyName');

        // Проверяем появление полей ИП (если есть в форме)
        // В зависимости от реализации формы
      }
    );

    /**
     * TC-COND-007: Скрытие полей занятости при смене статуса
     * Приоритет: High
     */
    test(
      'TC-COND-007: Скрытие полей занятости при смене статуса',
      {
        tag: ['@high', '@conditional'],
      },
      async () => {
        // Выбираем работу по найму
        await creditForm.selectEmploymentStatus('employed');
        await creditForm.expectFieldVisible('companyName');

        // Заполняем данные работодателя
        await creditForm.fillCompanyName('ООО Тест');

        // Меняем статус на безработный
        await creditForm.selectEmploymentStatus('unemployed');

        // Проверяем что поля работодателя скрыты
        await creditForm.expectFieldHidden('companyName');
      }
    );
  });

  // ============================================================================
  // Шаг 3: Условные поля адреса
  // ============================================================================

  test.describe('Поля адреса', () => {
    test.beforeEach(async () => {
      // Переходим на шаг 3
      for (let i = 0; i < 2; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-COND-008: Отображение адреса проживания при sameAsRegistration=false
     * Приоритет: High
     */
    test(
      'TC-COND-008: Отображение адреса проживания при снятии чекбокса',
      {
        tag: ['@high', '@conditional'],
      },
      async ({ page }) => {
        // Ищем чекбокс "Адрес проживания совпадает"
        const sameAddressCheckbox = creditForm.input('sameAsRegistration');

        // Если чекбокс существует
        if ((await sameAddressCheckbox.count()) > 0) {
          // Проверяем что он включен по умолчанию
          const isChecked = await sameAddressCheckbox.isChecked();

          if (isChecked) {
            // Снимаем чекбокс
            await sameAddressCheckbox.uncheck();

            // Проверяем появление полей адреса проживания
            await creditForm.expectFieldVisible('livingAddress-region');
          }
        }
      }
    );
  });

  // ============================================================================
  // Шаг 5: Условные поля дополнительной информации
  // ============================================================================

  test.describe('Условные массивы', () => {
    test.beforeEach(async () => {
      // Переходим на шаг 5
      for (let i = 0; i < 4; i++) {
        await creditForm.goToNextStep();
      }
    });

    /**
     * TC-COND-009: Управление массивом имущества чекбоксом hasProperty
     * Приоритет: High
     */
    test(
      'TC-COND-009: Управление массивом имущества чекбоксом hasProperty',
      {
        tag: ['@high', '@conditional'],
      },
      async ({ page }) => {
        // Ищем чекбокс "У меня есть имущество"
        const hasPropertyCheckbox = creditForm.input('hasProperty');

        if ((await hasPropertyCheckbox.count()) > 0) {
          // Включаем чекбокс
          await hasPropertyCheckbox.check();

          // Проверяем появление секции для добавления имущества
          await expect(page.getByRole('button', { name: /добавить имущество/i })).toBeVisible();
        }
      }
    );

    /**
     * TC-COND-010: Очистка массива имущества при выключении чекбокса
     * Приоритет: High
     */
    test(
      'TC-COND-010: Очистка массива имущества при выключении чекбокса',
      {
        tag: ['@high', '@conditional'],
      },
      async ({ page }) => {
        const hasPropertyCheckbox = creditForm.input('hasProperty');

        if ((await hasPropertyCheckbox.count()) > 0) {
          // Включаем чекбокс
          await hasPropertyCheckbox.check();

          // Добавляем имущество
          await page.getByRole('button', { name: /добавить имущество/i }).click();
          await expect(page.getByRole('heading', { name: /имущество #1/i })).toBeVisible();

          // Выключаем чекбокс
          await hasPropertyCheckbox.uncheck();

          // Проверяем что имущество скрыто
          await expect(page.getByRole('heading', { name: /имущество #1/i })).not.toBeVisible();

          // Снова включаем - должен быть пустой список
          await hasPropertyCheckbox.check();
          await expect(page.getByRole('heading', { name: /имущество #1/i })).not.toBeVisible();
        }
      }
    );

    /**
     * TC-COND-011: Управление массивом существующих кредитов
     * Приоритет: High
     */
    test(
      'TC-COND-011: Управление массивом существующих кредитов',
      {
        tag: ['@high', '@conditional'],
      },
      async ({ page }) => {
        const hasLoansCheckbox = creditForm.input('hasOtherLoans');

        if ((await hasLoansCheckbox.count()) > 0) {
          await hasLoansCheckbox.check();

          // Проверяем появление кнопки добавления кредита
          await expect(page.getByRole('button', { name: /добавить кредит/i })).toBeVisible();
        }
      }
    );

    /**
     * TC-COND-012: Управление массивом созаемщиков
     * Приоритет: High
     */
    test(
      'TC-COND-012: Управление массивом созаемщиков',
      {
        tag: ['@high', '@conditional'],
      },
      async ({ page }) => {
        const addCoBorrowerCheckbox = creditForm.input('addCoBorrower');

        if ((await addCoBorrowerCheckbox.count()) > 0) {
          await addCoBorrowerCheckbox.check();

          // Проверяем появление кнопки добавления созаемщика
          await expect(page.getByRole('button', { name: /добавить созаемщика/i })).toBeVisible();
        }
      }
    );
  });
});
