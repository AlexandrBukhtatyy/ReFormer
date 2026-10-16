import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model страницы выбора дат (`/demo/date-picker`).
 *
 * testId-конвенция FormField: `field-/label-/input-/error-<testId>`; крестик сброса —
 * `input-<testId>-clear`. День календаря ищется по `data-day` (локальная дата `yyyy-MM-dd`, её
 * ставит react-day-picker) — дни соседних месяцев (`rdp-outside`) отбрасываются, иначе при двух
 * месяцах рядом одна дата нашлась бы дважды.
 */
export class DatePickerPage {
  readonly page: Page;
  readonly baseUrl = '/demo/date-picker';

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
    await expect(this.trigger('vacation')).toBeVisible();
  }

  // ── Локаторы ──────────────────────────────────────────────────────────────

  /** Кнопка-триггер поля. */
  trigger(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}"]`);
  }

  /** Крестик сброса (`clearable`). */
  clearButton(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}-clear"]`);
  }

  /** Открытый календарь. */
  get popover(): Locator {
    return this.page.locator('[data-slot="popover-content"]');
  }

  /** Кнопка дня в открытом календаре. */
  day(date: string): Locator {
    return this.popover.locator(`td[data-day="${date}"]:not(.rdp-outside) button`);
  }

  error(testId: string): Locator {
    return this.page.locator(`[data-testid="error-${testId}"]`);
  }

  // ── Действия ──────────────────────────────────────────────────────────────

  async open(testId: string) {
    await this.trigger(testId).click();
    await expect(this.popover).toBeVisible();
  }

  async close() {
    await this.page.keyboard.press('Escape');
    await expect(this.popover).toBeHidden();
  }

  async pickDay(date: string) {
    await this.day(date).click();
  }

  async validate() {
    await this.page.locator('[data-testid="btn-validate"]').click();
  }

  async reset() {
    await this.page.locator('[data-testid="btn-reset"]').click();
  }

  /** Снимок модели формы; даты в нём — локальные `yyyy-MM-dd`. */
  async modelSnapshot(): Promise<Record<string, unknown>> {
    await this.page.locator('[data-testid="btn-snapshot"]').click();
    const text = await this.page.locator('[data-testid="model-snapshot"]').textContent();
    return JSON.parse(text ?? '{}') as Record<string, unknown>;
  }

  // ── Ожидания ──────────────────────────────────────────────────────────────

  /** Значение поля в модели — пустое значение хранится по-разному (`null` / `[]`), по DOM не видно. */
  async expectValue(testId: string, expected: unknown) {
    const model = await this.modelSnapshot();
    expect(model[testId], `значение поля ${testId}`).toEqual(expected);
  }

  async expectNoRuntimeErrors() {
    expect(this.pageErrors, 'исключения страницы').toEqual([]);
    expect(this.consoleErrors, 'ошибки консоли').toEqual([]);
  }
}

/**
 * Дата `yyyy-MM-dd` в текущем (`monthOffset = 0`) или соседнем месяце — тест не зависит от дня
 * запуска: календарь без значения открывается на текущем месяце.
 */
export function dayOf(monthOffset: number, day: number): string {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth() + monthOffset, day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `yyyy-MM-dd` → `dd.MM.yyyy` (формат подписи полей демо). */
export function dotted(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}
