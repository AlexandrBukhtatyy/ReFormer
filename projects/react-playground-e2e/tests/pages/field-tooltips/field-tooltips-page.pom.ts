import path from 'path';
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model страницы подсказок-иконок (`/demo/field-tooltips`).
 *
 * testId-конвенция: к `field-/label-/input-/error-<testId>` FormField добавляются иконки
 *  - `label-tooltip-<testId>` — иконка после подписи (проп `labelTooltip`, рисует FormField);
 *  - `input-<testId>-tooltip` — иконка в самом контроле (проп `tooltip`);
 *  - `input-<testId>-<value>-tooltip` — иконка у варианта RadioGroup (`options[].tooltip`).
 *
 * Контент тултипа живёт в Portal: Radix рендерит видимый блок `[data-slot="tooltip-content"]` и
 * скрытый дубль `role="tooltip"` для screen reader — видимость проверяем по первому.
 */
export class FieldTooltipsPage {
  readonly page: Page;
  readonly baseUrl = '/demo/field-tooltips';

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
    await expect(this.control('email')).toBeVisible();
  }

  // ── Локаторы ──────────────────────────────────────────────────────────────

  field(testId: string): Locator {
    return this.page.locator(`[data-testid="field-${testId}"]`);
  }

  control(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}"]`);
  }

  /** Иконка после подписи (`labelTooltip`). */
  labelHint(testId: string): Locator {
    return this.page.locator(`[data-testid="label-tooltip-${testId}"]`);
  }

  /** Иконка в самом контроле (`tooltip`). */
  controlHint(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}-tooltip"]`);
  }

  /** Иконка у варианта RadioGroup. */
  optionHint(testId: string, value: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}-${value}-tooltip"]`);
  }

  /**
   * Видимый блок открытого тултипа. Внутри него Radix держит ещё и скрытый дубль `role="tooltip"`,
   * поэтому текст сверяется через `toContainText` — `toHaveText` увидел бы его дважды.
   */
  tooltip(): Locator {
    return this.page.locator('[data-slot="tooltip-content"]');
  }

  /** Крестик очистки внутри поля (у Select/Combobox — кнопка «Clear selection»). */
  clearButton(testId: string): Locator {
    return this.field(testId).getByRole('button', { name: 'Clear selection' });
  }

  /** Шеврон — последний svg внутри триггера. */
  chevron(testId: string): Locator {
    return this.control(testId).locator('svg').last();
  }

  // ── Хелперы ───────────────────────────────────────────────────────────────

  /** Левый край элемента в координатах страницы. */
  async left(locator: Locator): Promise<number> {
    const box = await locator.boundingBox();
    expect(box, 'элемент не отрисован').not.toBeNull();
    return box!.x;
  }

  async right(locator: Locator): Promise<number> {
    const box = await locator.boundingBox();
    expect(box, 'элемент не отрисован').not.toBeNull();
    return box!.x + box!.width;
  }

  /** Увести курсор с иконки, чтобы hover-тултип не мешал следующему шагу. */
  async movePointerAway() {
    await this.page.mouse.move(0, 0);
  }

  async screenshot(scenario: string) {
    await this.page.screenshot({
      path: path.resolve(__dirname, '../../../screenshots/field-tooltips', `${scenario}.png`),
      fullPage: true,
    });
  }
}
