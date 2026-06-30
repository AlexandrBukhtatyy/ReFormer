/**
 * E2E-тесты перестановки элементов массива (move up / down).
 *
 * Проверяет:
 * - кнопки ↑/↓ меняют порядок элементов;
 * - значения полей «едут» вместе с элементом (состояние под-формы сохраняется);
 * - кнопки отключены на границах (первый ↑ / последний ↓).
 *
 * Массив: созаёмщики на шаге 5. На этом шаге включён только массив созаёмщиков
 * (имущество/кредиты выключены), поэтому data-testid `array-item-${i}-move-*` и
 * `input-coBorrower-*` уникальны на странице — скоуп по секции не нужен. Spec
 * переиспользуется во всех 3 вариантах (compound / renderer / json).
 */

import { test, expect } from '../../shared/test-factory';
import type { CreditFormPage } from './credit-form-page.pom';

/** Шаг 5 с ровно `count` созаёмщиками (имущество/кредиты выключены). */
async function gotoStep5WithCoBorrowers(creditForm: CreditFormPage, count: number) {
  await creditForm.goto();
  await creditForm.fillAndNavigateToStep4();
  await creditForm.fillStep4Employment();
  await creditForm.goToNextStep();

  await creditForm.toggleHasProperty(false);
  await creditForm.toggleHasLoans(false);
  await creditForm.toggleAddCoBorrower(true);

  const lastNames = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
  // Доводим количество до нужного (форма стартует с 0 созаёмщиков). Каждую итерацию
  // дожидаемся инкремента счётчика — гарантирует, что add зарегистрировался до следующей проверки.
  while ((await lastNames.count()) < count) {
    const before = await lastNames.count();
    await creditForm.addCoBorrower();
    await expect(lastNames).toHaveCount(before + 1);
  }
  await expect(lastNames).toHaveCount(count);
}

test.describe('Перестановка элементов массива', { tag: ['@arrays', '@reorder'] }, () => {
  test('REORDER-001: ↓ опускает элемент, значения едут вместе с ним', async ({ creditForm }) => {
    await gotoStep5WithCoBorrowers(creditForm, 3);
    const lastNames = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
    const incomes = creditForm.page.locator('[data-testid="input-coBorrower-monthlyIncome"]');

    await lastNames.nth(0).fill('AAA');
    await incomes.nth(0).fill('11111');
    await lastNames.nth(1).fill('BBB');
    await incomes.nth(1).fill('22222');
    await lastNames.nth(2).fill('CCC');
    await incomes.nth(2).fill('33333');

    // Опускаем первый элемент → BBB, AAA, CCC
    await creditForm.moveItemDown(0);

    await expect(lastNames.nth(0)).toHaveValue('BBB');
    await expect(lastNames.nth(1)).toHaveValue('AAA');
    await expect(lastNames.nth(2)).toHaveValue('CCC');
    // Состояние сохранилось — доход едет вместе с фамилией
    await expect(incomes.nth(0)).toHaveValue('22222');
    await expect(incomes.nth(1)).toHaveValue('11111');
    await expect(incomes.nth(2)).toHaveValue('33333');
  });

  test('REORDER-002: ↑ поднимает элемент', async ({ creditForm }) => {
    await gotoStep5WithCoBorrowers(creditForm, 3);
    const lastNames = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');

    await lastNames.nth(0).fill('AAA');
    await lastNames.nth(1).fill('BBB');
    await lastNames.nth(2).fill('CCC');

    // Поднимаем последний элемент → AAA, CCC, BBB
    await creditForm.moveItemUp(2);

    await expect(lastNames.nth(0)).toHaveValue('AAA');
    await expect(lastNames.nth(1)).toHaveValue('CCC');
    await expect(lastNames.nth(2)).toHaveValue('BBB');
  });

  test('REORDER-003: кнопки отключены на границах', async ({ creditForm }) => {
    await gotoStep5WithCoBorrowers(creditForm, 3);
    const lastNames = creditForm.page.locator('[data-testid="input-coBorrower-lastName"]');
    const lastIndex = (await lastNames.count()) - 1;

    // У первого элемента «вверх» недоступна, у последнего — «вниз»
    await expect(creditForm.moveUpButton(0)).toBeDisabled();
    await expect(creditForm.moveDownButton(lastIndex)).toBeDisabled();

    // А внутренние/обратные кнопки доступны
    await expect(creditForm.moveDownButton(0)).toBeEnabled();
    await expect(creditForm.moveUpButton(lastIndex)).toBeEnabled();
  });
});
