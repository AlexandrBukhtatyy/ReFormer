/**
 * Разметка мастера и массивов: как сценарий находит текущий шаг, «Назад» и строки массива.
 *
 * Поля у всех страниц размечены одинаково (`field-`, `input-`, `error-{путь}`), а мастер и массивы —
 * по-разному. Участники бенчмарка следуют его DOM-контракту (BENCH-CONTRACT §4): заголовок шага
 * `step-current` с номером в `data-step`, «Назад» есть и на первом шаге — выключенная, кнопки
 * массива названы по массиву (`btn-add-{массив}`, `btn-remove-{массив}-{строка}`). Киты библиотек
 * компонентов размечают мастер и массив по-своему — поэтому POM спрашивает разметку, как спрашивает
 * драйвер контролов (./control-driver.ts).
 *
 * Разметка по умолчанию — бенчмарка: через неё идут все участники.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export interface FormMarkup {
  /** Элемент текущего шага мастера. */
  currentStep(page: Page): Locator;
  /** Атрибут элемента текущего шага с его номером (с единицы). */
  readonly stepNumberAttribute: string;
  /** Кнопка «Назад». */
  previousButton(page: Page): Locator;
  /** На первом шаге назад не уйти: кнопка выключена либо её нет. */
  expectNoPrevious(page: Page): Promise<void>;
  /** «Добавить» массива `array`. */
  addButton(page: Page, array: string): Locator;
  /** «Удалить» строки `index` массива `array`. */
  removeButton(page: Page, array: string, index: number): Locator;
  /** Строки массива `array` на экране. */
  rows(page: Page, array: string): Locator;
}

/** Разметка бенчмарка (BENCH-CONTRACT §4). */
export const benchMarkup: FormMarkup = {
  currentStep: (page) => page.getByTestId('step-current'),
  stepNumberAttribute: 'data-step',
  previousButton: (page) => page.getByTestId('btn-prev'),
  async expectNoPrevious(page) {
    await expect(page.getByTestId('btn-prev')).toBeDisabled();
  },
  addButton: (page, array) => page.getByTestId(`btn-add-${array}`),
  removeButton: (page, array, index) => page.getByTestId(`btn-remove-${array}-${index}`),
  // Строки — по кнопкам «Удалить»: у участников бенчмарка она есть у каждой строки.
  rows: (page, array) => page.locator(`[data-testid^="btn-remove-${array}-"]`),
};
