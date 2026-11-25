/**
 * Разметка мастера и массивов у китов: одна у `@reformer/ui-kit`, `@reformer/kit-vuetify` и
 * `@reformer/kit-taiga` (DOM-CONTRACT.md).
 *
 * - Текущий шаг — пункт шапки `step-indicator-{n}` с `data-step-current="true"`, номер — в
 *   `data-step-number`. «Назад» (`btn-previous`) на первом шаге нет вовсе.
 * - Массив — секция `[data-slot="field-array"]` с заголовком; кнопки и строки внутри неё не названы
 *   по массиву (`array-add`, `array-item-{i}`, `array-item-{i}-remove`), поэтому массив находится
 *   по заголовку секции. «Удалить» у единственной строки нет — строки считаются по самим строкам.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { FormMarkup } from '../forms-benchmark-e2e/pom/form-markup';

/** Заголовки секций массивов — как их задаёт документ формы (forms-benchmark/src/cross). */
const ARRAY_TITLES: Record<string, string> = {
  properties: 'Имущество',
  existingLoans: 'Существующие кредиты',
  coBorrowers: 'Созаемщики',
};

function section(page: Page, array: string): Locator {
  const title = ARRAY_TITLES[array];
  if (!title) throw new Error(`нет заголовка секции массива ${array}`);
  return page
    .locator('[data-slot="field-array"]')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

export const kitMarkup: FormMarkup = {
  currentStep: (page) => page.locator('[data-testid^="step-indicator-"][data-step-current="true"]'),
  stepNumberAttribute: 'data-step-number',
  previousButton: (page) => page.getByTestId('btn-previous'),
  async expectNoPrevious(page) {
    await expect(page.getByTestId('btn-previous')).toHaveCount(0);
  },
  addButton: (page, array) => section(page, array).getByTestId('array-add'),
  removeButton: (page, array, index) =>
    section(page, array).getByTestId(`array-item-${index}-remove`),
  // Строки — прямые дети секции: у вложенных узлов строки свои testid.
  rows: (page, array) => section(page, array).locator(':scope > [data-testid^="array-item-"]'),
};
