import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model страницы дерева (`/demo/tree`).
 *
 * На странице три дерева, и добираться до строк у них приходится по-разному:
 *  - карточки `tree-showcase` и `tree-lazy` держат свободный `Tree` прямо в разметке;
 *  - деревья `ComboboxTree` и `ComboboxTreeMulti` живут в портале поповера и до щелчка по
 *    триггеру в DOM отсутствуют вовсе.
 * Отсюда «область» ({@link TreeScope}) у каждого локатора строки вместо одного корня на страницу.
 *
 * Адреса узлов НЕ захардкожены: их отдаёт сама разметка (`data-node-id`). Фикстура демо — дерево
 * файлов, и привязка теста к конкретному пути делала бы красным любой её пересбор, не сказав при
 * этом ничего о поведении. Ветку от листа отличает `aria-expanded`: дерево ставит его только там,
 * где есть что раскрывать, — у листьев атрибута нет.
 *
 * Строки в DOM плоские (уровень вложенности объявлен через `aria-level`) и виртуализированы:
 * существуют только те, что попали в окно прокрутки. Поэтому «сколько всего узлов» спрашивать
 * бессмысленно, а вот «какие строки появились после раскрытия» — ровно то, что видно снаружи.
 */

/** Снимок модели формы демо. */
export interface TreeDemoModel {
  /** `ComboboxTreeField` — адрес одного файла. */
  configFile: string | null;
  /**
   * `ComboboxTreeMultiField` — адреса файлов. Пустой выбор приходит как `null`, никогда `[]`:
   * массив в модели построил бы ArrayNode, и поля не существовало бы вовсе.
   */
  assetFiles: string[] | null;
}

/** Три места, где на странице живёт дерево. */
export type TreeScope = 'tree-showcase' | 'tree-lazy' | 'popover';

export class TreePage {
  readonly page: Page;
  readonly baseUrl = '/demo/tree';

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
    await expect(this.trigger('configFile')).toBeVisible();
    // Верхний уровень ленивого дерева читается уже после монтирования, поэтому ждём не карточку,
    // а первую строку в ней: до неё щелчки уходили бы в пустоту.
    await expect(this.rows('tree-lazy').first()).toBeVisible();
  }

  // ── Области ───────────────────────────────────────────────────────────────

  /**
   * Содержимое ОТКРЫТОГО поповера.
   *
   * `[data-state="open"]` — не украшение: закрытый Radix оставляет свой узел в документе на
   * время анимации выхода, и после второго открытия на странице оказывается два элемента
   * с `data-slot="popover-content"`. Без сужения строгий режим playwright падает на
   * неоднозначности ровно в тех сценариях, где поповеры открывают по очереди.
   */
  popover(): Locator {
    return this.page.locator('[data-slot="popover-content"][data-state="open"]');
  }

  /**
   * Контейнер, внутри которого ищутся строки. Корень самого дерева (`[data-slot="tree"]`) для
   * этого не нужен: строки лежат внутри него, а он — внутри карточки, так что один и тот же
   * селектор работает и когда `data-testid` стоит на обёртке, и когда он попал прямо на `Tree`.
   */
  scopeRoot(scope: TreeScope): Locator {
    if (scope === 'popover') return this.popover();
    return this.page.locator(`[data-testid="${scope}"]`);
  }

  // ── Строки дерева ─────────────────────────────────────────────────────────

  /** Все строки области — в порядке отрисовки. */
  rows(scope: TreeScope): Locator {
    return this.scopeRoot(scope).locator('[data-slot="tree-item"]');
  }

  row(scope: TreeScope, nodeId: string): Locator {
    return this.scopeRoot(scope).locator(`[data-slot="tree-item"][data-node-id="${nodeId}"]`);
  }

  /** Подпись строки. По ней сверяется то, что показывает триггер комбобокса. */
  rowLabel(scope: TreeScope, nodeId: string): Locator {
    return this.row(scope, nodeId).locator('[data-slot="item-title"]');
  }

  /** Ветки: `aria-expanded` дерево ставит только на них. */
  branches(scope: TreeScope): Locator {
    return this.scopeRoot(scope).locator('[data-slot="tree-item"][aria-expanded]');
  }

  /** Листья — строки без `aria-expanded`, то есть файлы. */
  leaves(scope: TreeScope): Locator {
    return this.scopeRoot(scope).locator('[data-slot="tree-item"]:not([aria-expanded])');
  }

  /**
   * Треугольник ветки. Щелчок по нему — ТОЛЬКО раскрытие: обработчик гасит всплытие, чтобы из
   * одного щелчка не вышло двух действий, раскрытия и запуска строки.
   */
  chevron(scope: TreeScope, nodeId: string): Locator {
    return this.row(scope, nodeId).locator('[data-slot="tree-item-chevron"]');
  }

  /** Крутилка на месте треугольника — единственное снаружи свидетельство похода в источник. */
  loader(scope: TreeScope, nodeId: string): Locator {
    return this.row(scope, nodeId).locator('[data-slot="tree-item-loader"]');
  }

  /** Галочка отмеченной строки множественного варианта (она справа, а не чекбоксом слева). */
  checks(): Locator {
    return this.popover().locator('[data-slot="combobox-tree-multi-check"]');
  }

  // ── Поля формы ────────────────────────────────────────────────────────────

  /** Обёртка поля (FormField). */
  field(testId: string): Locator {
    return this.page.locator(`[data-testid="field-${testId}"]`);
  }

  /** Триггер комбобокса: он же корень контрола, он же префикс testId для строк дерева. */
  trigger(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}"]`);
  }

  /** Подпись выбранного узла в триггере одиночного варианта. */
  triggerValue(testId: string): Locator {
    return this.trigger(testId).locator('[data-slot="combobox-tree-value"]');
  }

  /** Поле поиска над деревом в поповере. */
  search(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}-search"]`);
  }

  /** Крестик очистки. Живёт ВНЕ триггера: интерактивный элемент внутри `button` невалиден. */
  clearButton(testId: string): Locator {
    return this.page.locator(`[data-testid="input-${testId}-clear"]`);
  }

  /** Чипы выбранного в триггере множественного варианта. */
  chips(testId: string): Locator {
    return this.trigger(testId).locator('[data-slot="combobox-tree-multi-chip"]');
  }

  /** Сводка «Выбрано: N» вместо чипов, когда выбранных больше `summaryThreshold`. */
  summary(testId: string): Locator {
    return this.trigger(testId).locator('[data-slot="combobox-tree-multi-summary"]');
  }

  error(testId: string): Locator {
    return this.page.locator(`[data-testid="error-${testId}"]`);
  }

  // ── Действия ──────────────────────────────────────────────────────────────

  async open(testId: string) {
    await this.trigger(testId).click();
    await expect(this.popover()).toBeVisible();
    // Поповер виден раньше, чем дерево в нём смонтировано, — ждём первую строку.
    await expect(this.rows('popover').first()).toBeVisible();
  }

  /**
   * Закрыть поповер. Escape дереву не принадлежит ни в одном из вариантов комбобокса: обработчик
   * возвращает управление, не гася событие, и его ловит поповер.
   */
  async close() {
    await this.page.keyboard.press('Escape');
    await expect(this.popover()).toBeHidden();
  }

  /** Щелчок по строке: для файла это выбор, для каталога — раскрытие. */
  async clickRow(scope: TreeScope, nodeId: string) {
    await this.row(scope, nodeId).click();
  }

  /** Раскрыть или свернуть ветку треугольником, не трогая выбор. */
  async toggleChevron(scope: TreeScope, nodeId: string) {
    await this.chevron(scope, nodeId).click();
  }

  async clear(testId: string) {
    await this.clearButton(testId).click();
  }

  async validate() {
    await this.page.locator('[data-testid="btn-validate"]').click();
  }

  async reset() {
    await this.page.locator('[data-testid="btn-reset"]').click();
  }

  // ── Разведка фикстуры ─────────────────────────────────────────────────────

  /** Адреса всех видимых строк области. */
  async visibleIds(scope: TreeScope): Promise<string[]> {
    return this.rows(scope).evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-node-id') ?? '')
    );
  }

  /** Адреса видимых файлов области. */
  async leafIds(scope: TreeScope): Promise<string[]> {
    return this.leaves(scope).evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-node-id') ?? '')
    );
  }

  /**
   * Адрес первой ветки области. По умолчанию — СВЁРНУТОЙ: часть каталогов демо может быть
   * раскрыта через `defaultExpandedIds`, и щелчок по такой ветке её бы свернул, а не раскрыл.
   */
  async firstBranchId(scope: TreeScope, expanded = false): Promise<string> {
    const branch = this.scopeRoot(scope)
      .locator(`[data-slot="tree-item"][aria-expanded="${String(expanded)}"]`)
      .first();
    await expect(branch, `в дереве «${scope}» нет подходящей ветки`).toBeVisible();
    const id = await branch.getAttribute('data-node-id');
    expect(id, 'у строки дерева нет data-node-id').not.toBeNull();
    return id ?? '';
  }

  /**
   * Открыть поповер и добраться до первого файла, раскрыв ради него каталог, если на верхнем
   * уровне одни каталоги. Возвращает адрес файла: тест фикстуру не знает и знать не должен.
   */
  async openToFirstLeaf(testId: string): Promise<string> {
    await this.open(testId);
    if ((await this.leaves('popover').count()) === 0) {
      await this.clickRow('popover', await this.firstBranchId('popover'));
      await expect(this.leaves('popover').first()).toBeVisible();
    }
    const ids = await this.leafIds('popover');
    expect(ids.length, 'в дереве комбобокса нет ни одного файла').toBeGreaterThan(0);
    return ids[0];
  }

  // ── Ожидания ──────────────────────────────────────────────────────────────

  /** Снимок модели формы — единственный источник истины о значении поля. */
  async modelSnapshot(): Promise<TreeDemoModel> {
    await this.page.locator('[data-testid="btn-snapshot"]').click();
    const text = await this.page.locator('[data-testid="model-snapshot"]').textContent();
    return JSON.parse(text ?? '{}') as TreeDemoModel;
  }

  /**
   * Значение поля в модели.
   *
   * Проверять надо именно модель, а не разметку: выделение строки в дереве и выбор значения —
   * разные вещи, а у множественного варианта пустой выбор обязан приходить как `null`, а не `[]`.
   * По DOM ни ту, ни другую разницу не увидеть.
   */
  async expectValue<K extends keyof TreeDemoModel>(field: K, expected: TreeDemoModel[K]) {
    const model = await this.modelSnapshot();
    expect(model[field], `значение поля ${String(field)}`).toEqual(expected);
  }

  async expectNoRuntimeErrors() {
    expect(this.pageErrors, 'исключения страницы').toEqual([]);
    expect(this.consoleErrors, 'ошибки консоли').toEqual([]);
  }
}
