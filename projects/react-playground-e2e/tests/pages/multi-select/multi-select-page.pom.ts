import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model страницы примеров множественного выбора (`/examples/multi-select`).
 *
 * testId-конвенция FormField: `field-/label-/input-/error-<testId>`. У мультивыборов к ней
 * добавляется per-option идентификатор `input-<testId>-<value>` — он одинаков у всех четырёх
 * контролов, хотя разметка под ним разная:
 *  - `ToggleGroupMulti` — `<button aria-pressed>` (в multiple-режиме Radix даёт toolbar/button,
 *    а НЕ radiogroup/radio, как в одиночном);
 *  - `NativeSelectMulti` — `<option>` внутри нативного `<select multiple>`;
 *  - `ComboboxMulti` / `SelectMulti` — пункт списка внутри Popover, поэтому перед выбором
 *    контрол надо открыть.
 */
export class MultiSelectPage {
  readonly page: Page;
  readonly baseUrl = '/examples/multi-select';

  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];

  constructor(page: Page) {
    this.page = page;
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => this.pageErrors.push(error.message));
  }

  async goto() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForLoadState('networkidle');
    await expect(this.trigger('tags')).toBeVisible();
  }

  // ── Локаторы ──────────────────────────────────────────────────────────────

  /** Обёртка поля (FormField). */
  field(testId: string): Locator {
    return this.page.locator(`[data-testid="field-${testId}"]`);
  }

  /** Корень контрола: триггер у поповерных, контейнер группы / `<select>` у остальных. */
  trigger(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}"]`);
  }

  /** Конкретная опция. У поповерных доступна только при открытом списке. */
  option(testId: string, value: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}-${value}"]`);
  }

  /** Чипы выбранного в триггере (`ComboboxMulti` / `SelectMulti`). */
  chips(testId: string): Locator {
    return this.trigger(testId).locator('[data-slot$="-multi-chip"]');
  }

  /** Сводка «Выбрано: N» вместо чипов, когда выбранных больше `summaryThreshold`. */
  summary(testId: string): Locator {
    return this.trigger(testId).locator('[data-slot$="-multi-summary"]');
  }

  /** Сообщение об ошибке поля. */
  error(testId: string): Locator {
    return this.page.locator(`[data-testid="error-${testId}"]`);
  }

  // ── Действия ──────────────────────────────────────────────────────────────

  /** Открыть поповерный контрол (`ComboboxMulti` / `SelectMulti`). */
  async open(testId: string) {
    await this.trigger(testId).click();
    await expect(this.page.locator('[data-slot="popover-content"]')).toBeVisible();
  }

  /** Закрыть открытый поповер. */
  async close() {
    await this.page.keyboard.press('Escape');
    await expect(this.page.locator('[data-slot="popover-content"]')).toBeHidden();
  }

  /** Тогл опции у НЕпоповерного контрола (`ToggleGroupMulti`). */
  async toggle(testId: string, value: string) {
    await this.option(testId, value).click();
  }

  /**
   * Выбрать несколько опций в поповерном контроле за одно открытие.
   *
   * Именно за одно: список НЕ закрывается после выбора — это поведенческое отличие мультивыбора
   * от одиночного варианта, и тест на него опирается напрямую.
   */
  async pickMany(testId: string, values: string[]) {
    await this.open(testId);
    for (const value of values) await this.option(testId, value).click();
    await this.close();
  }

  /** Выбор в нативном листбоксе. */
  async selectNative(testId: string, values: string[]) {
    await this.trigger(testId).selectOption(values);
  }

  async validate() {
    await this.page.locator('[data-testid="btn-validate"]').click();
  }

  async reset() {
    await this.page.locator('[data-testid="btn-reset"]').click();
  }

  /** Снимок модели формы — единственный источник истины о значении поля. */
  async modelSnapshot(): Promise<Record<string, string[] | null>> {
    await this.page.locator('[data-testid="btn-snapshot"]').click();
    const text = await this.page.locator('[data-testid="model-snapshot"]').textContent();
    return JSON.parse(text ?? '{}') as Record<string, string[] | null>;
  }

  // ── Ожидания ──────────────────────────────────────────────────────────────

  /**
   * Значение поля в модели.
   *
   * Проверять надо именно модель, а не разметку: главный инвариант мультивыбора — пустой выбор
   * приходит как `null`, а не `[]` (массив в начальном значении превратил бы поле в ArrayNode,
   * и его бы не существовало). По DOM эту разницу не увидеть.
   */
  async expectValue(testId: string, expected: string[] | null) {
    const model = await this.modelSnapshot();
    expect(model[testId], `значение поля ${testId}`).toEqual(expected);
  }

  async expectNoRuntimeErrors() {
    expect(this.pageErrors, 'исключения страницы').toEqual([]);
    expect(this.consoleErrors, 'ошибки консоли').toEqual([]);
  }
}
