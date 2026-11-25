/**
 * Драйвер контролов: как сценарий ведёт виджет, у которого нет нативного элемента формы.
 *
 * Текст, число, дата, флажок и радиокнопка у всех страниц — нативные элементы (либо элементы с той
 * же ролью), и POM ведёт их напрямую. Список — исключение: у нативного `<select>` пункты лежат в
 * разметке и выбираются одним вызовом, а у библиотеки компонентов список — всплывающая панель,
 * которой нет в DOM, пока она закрыта. Что именно делать со списком, POM спрашивает у драйвера.
 *
 * Драйвер по умолчанию — нативный: через него идут все участники бенчмарка. Страницы на
 * библиотеках компонентов передают POM свой драйвер.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** Список выбора на странице. */
export interface SelectTarget {
  page: Page;
  /** Путь поля DOM-контракта: `registrationAddress-city`. */
  id: string;
  /** Элемент `input-{id}`. */
  input: Locator;
}

export interface ControlDriver {
  /** Выбрать пункт списка по значению; `''` — пустой пункт. */
  select(target: SelectTarget, value: string): Promise<void>;
  /** Значения пунктов списка по порядку; пустой пункт `''` — в их числе. */
  options(target: SelectTarget): Promise<string[]>;
  /** Дождаться, что в списке выбрано значение `value`. */
  expectSelected(target: SelectTarget, value: string): Promise<void>;
}

/** Нативный `<select>`: `input-{id}` стоит на нём самом. */
export const nativeDriver: ControlDriver = {
  async select({ input }, value) {
    await input.selectOption(value);
  },
  options: ({ input }) =>
    input
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)),
  async expectSelected({ input }, value) {
    await expect(input).toHaveValue(value);
  },
};
