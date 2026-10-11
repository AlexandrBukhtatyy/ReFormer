/**
 * Панель свойств узла — в настоящем браузере.
 *
 * Модель панели (какие поля, в каком порядке, чем правятся) проверена у себя
 * (`../palette/inspector-model.test`). Здесь — то, чего в модели нет и что видно только
 * отрисованным:
 *
 * - подсказка свойства живёт значком у подписи: текст не стоит строкой под полем, значок есть
 *   ровно там, где есть что сказать, а контрол получает текст через `aria-describedby`;
 * - выбор в панели — всегда список: булевы свойства секции собраны в один список
 *   с мультивыбором, и щелчок по пункту пишет в узел то же отдельное свойство, что раньше
 *   писал флажок;
 * - привязка к модели — список кита с вводом своего пути, а не поле ввода с родным списком
 *   браузера: тот же вид, что у соседних списков, и одна правка на выбор;
 * - отметка выбранного пункта во всех списках панели стоит у правого края, а подписи пунктов
 *   начинаются с одного отступа: списки трёх разных устройств читаются как один компонент.
 *
 * @module plugins/reformer/editor/ui/InspectorPanel.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { CatalogEntry } from '../../../core/catalog';
import { sampleSchema } from '../../../core/testing';
import { renderReact } from '../../../../.shared/render';
import { indexNodes } from '../model/node-index';
import { setPropOp } from '../model/ops';
import { createSessionRegistry, type SchemaSession } from '../session/sessions';
import { createFakeSchemaHost } from '../testing';
import { InspectorPanel } from './InspectorPanel';

const DOCUMENT = 'fake:form.json';

/** Поле «Тип кредита» образца — компонент `Select`. */
const SELECT_PATH = ['root', 'children', 0, 'children', 0] as const;

/**
 * По свойству на каждый вид контрола панели; `className` — без описания. Булевых три, в одной
 * секции: обычное, без описания и включённое китом по умолчанию.
 */
const PROPS_SCHEMA = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Подпись поля',
      'x-doc': { group: 'Control', type: 'string' },
    },
    className: { type: 'string', 'x-doc': { group: 'Control', type: 'string' } },
    size: {
      enum: ['sm', 'lg'],
      description: 'Размер контрола',
      'x-doc': { group: 'Control', type: 'string' },
    },
    options: {
      type: 'array',
      description: 'Варианты выбора',
      'x-doc': { group: 'Options', type: 'unknown[]' },
    },
    maxLength: {
      type: 'number',
      description: 'Наибольшая длина значения',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    required: {
      type: 'boolean',
      description: 'Поле обязательно.',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    readOnly: { type: 'boolean', 'x-doc': { group: 'State', type: 'boolean' } },
    clearable: {
      type: 'boolean',
      default: true,
      description: 'Крестик сброса значения',
      'x-doc': { group: 'State', type: 'boolean' },
    },
  },
} as unknown as PropsSchema;

const CATALOG: readonly CatalogEntry[] = [
  {
    name: 'Select',
    role: 'field',
    propsSchema: PROPS_SCHEMA,
    makeNode: () => ({ model: '$model(x)', component: '$component(Select)' }),
  },
];

/** Подпись списка флагов: двойник словаря отдаёт ключ. */
const FLAGS = 'inspector.flags';

/** Подпись поля привязки к модели — тоже ключом. */
const BINDING = 'inspector.binding';

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mount(): Promise<{ container: HTMLElement; session: SchemaSession }> {
  const host = createFakeSchemaHost({
    documentId: DOCUMENT,
    text: JSON.stringify(sampleSchema()),
    catalog: CATALOG,
  });
  const registry = createSessionRegistry({ host });
  const session = registry.open(DOCUMENT);
  if (session === null) throw new Error('сеанс не открылся');
  const id = indexNodes(session.get().model).idAt(SELECT_PATH);
  if (id === undefined) throw new Error('в образце нет поля Select');
  session.setSelection([id]);

  const mounted = renderReact(<InspectorPanel host={host} registry={registry} />);
  unmount = mounted.unmount;
  await vi.waitFor(() => {
    if (labelOf(mounted.container, 'Label') === null) throw new Error('панель ещё не отрисована');
  });
  return { container: mounted.container, session };
}

/** Свойства выделенного узла, как они записаны в модели документа. */
function propsOf(session: SchemaSession): Record<string, unknown> {
  let node: unknown = session.get().model;
  for (const step of SELECT_PATH) node = (node as Record<string | number, unknown>)[step];
  return ((node as { componentProps?: Record<string, unknown> }).componentProps ?? {}) as Record<
    string,
    unknown
  >;
}

/** Подпись свойства по её тексту: каталог выводит её из ключа пропа (`maxLength` → «Max Length»). */
function labelOf(container: HTMLElement, text: string): HTMLLabelElement | null {
  return (
    Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent?.trim() === text
    ) ?? null
  );
}

/** Строка свойства: подпись, значок подсказки рядом с ней и контрол, к которому она ведёт. */
function rowOf(container: HTMLElement, text: string) {
  const label = labelOf(container, text);
  if (label === null) throw new Error(`подписи «${text}» в панели нет`);
  const control = document.getElementById(label.htmlFor);
  const hint = label.parentElement?.querySelector<HTMLElement>('[data-slot="info-hint"]') ?? null;
  return { label, control, hint };
}

/** Текст подсказки контрола — тот, на который ссылается его `aria-describedby`. */
function describedText(control: HTMLElement | null): string {
  const id = control?.getAttribute('aria-describedby') ?? '';
  return document.getElementById(id)?.textContent ?? '';
}

describe('подсказка свойства — значком у подписи', () => {
  it('текст подсказки не стоит строкой под полем', async () => {
    const { container } = await mount();

    const { control, hint } = rowOf(container, 'Label');

    expect(hint).not.toBeNull();
    // В панели текст есть только скрытым дублем для читалки — видимой строки с ним нет.
    const occurrences = Array.from(container.querySelectorAll('*')).filter(
      (element) => element.children.length === 0 && element.textContent === 'Подпись поля'
    );
    expect(occurrences).toHaveLength(1);
    expect((occurrences[0] as HTMLElement).hidden).toBe(true);
    // Контрол описан этим же текстом: значок — не единственный способ его узнать.
    expect(control?.getAttribute('aria-describedby')).toBe(occurrences[0].id);
  });

  it('по наведению значок показывает подсказку', async () => {
    const { container } = await mount();
    const { hint } = rowOf(container, 'Label');
    if (hint === null) throw new Error('значка подсказки нет');

    await userEvent.hover(hint);

    await expect
      .poll(() => document.querySelector('[role="tooltip"]')?.textContent ?? '')
      .toContain('Подпись поля');
  });

  it('значок есть у каждого вида контрола, включая список флагов', async () => {
    const { container } = await mount();

    for (const key of ['Label', 'Size', 'Max Length', FLAGS]) {
      const { control, hint } = rowOf(container, key);
      expect(hint, key).not.toBeNull();
      expect(control, key).not.toBeNull();
      expect(control?.getAttribute('aria-describedby'), key).toBeTruthy();
    }
  });

  it('свойство без описания значка не получает', async () => {
    const { container } = await mount();

    const { control, hint } = rowOf(container, 'Class Name');

    expect(hint).toBeNull();
    // И ссылки на несуществующий текст у контрола нет.
    expect(control?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('свойство, которое правится только в JSON, говорит об этом значком', async () => {
    const { container } = await mount();

    const { control, hint } = rowOf(container, 'Options');

    expect(hint).not.toBeNull();
    expect(describedText(control)).toBe('inspector.readonly');
  });

  it('значок стоит вне подписи: щелчок по нему контрол не трогает', async () => {
    const { container } = await mount();
    const { label, hint, control } = rowOf(container, FLAGS);
    if (hint === null) throw new Error('значка подсказки нет');

    expect(label.contains(hint)).toBe(false);
    await userEvent.click(hint);

    // Список флагов остался закрытым: значок — не часть контрола.
    expect(control?.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('свойство — строкой: подпись слева, поле справа', () => {
  /** Ширина правого дока по умолчанию: раскладку проверяем там, где её видит человек. */
  const DOCK_WIDTH = 320;

  /**
   * Подписи фикстуры: привязка, ввод, список, число, значение только для чтения и список
   * флагов.
   */
  const ROWS = [BINDING, 'Label', 'Size', 'Max Length', 'Options', FLAGS];

  async function mountInDock(width = DOCK_WIDTH): Promise<HTMLElement> {
    const { container } = await mount();
    container.style.width = `${width}px`;
    return container;
  }

  const boxOf = (element: Element | null): DOMRect => {
    if (element === null) throw new Error('элемента строки нет');
    return element.getBoundingClientRect();
  };

  it('подпись и контрол стоят в одной строке, подпись — слева', async () => {
    const container = await mountInDock();

    for (const key of ROWS) {
      const { label, control } = rowOf(container, key);
      const text = boxOf(label);
      const field = boxOf(control);
      expect(text.right, key).toBeLessThanOrEqual(field.left);
      // Одна строка, а не подпись над полем: по высоте они перекрываются.
      expect(text.top, key).toBeLessThan(field.bottom);
      expect(text.bottom, key).toBeGreaterThan(field.top);
    }
  });

  it('контролы стоят ровной колонкой: одна левая граница и один правый край', async () => {
    const container = await mountInDock();

    const fields = ROWS.map((key) => boxOf(rowOf(container, key).control));
    const lefts = new Set(fields.map((field) => Math.round(field.left)));
    const rights = new Set(fields.map((field) => Math.round(field.right)));
    // Список кит рисует по ширине значения — в сетке он обязан занять колонку, как поле ввода.
    expect([...lefts]).toHaveLength(1);
    expect([...rights]).toHaveLength(1);
  });

  it('привязка, поле ввода, число и список — одной высоты', async () => {
    const container = await mountInDock();

    const heights = [BINDING, 'Label', 'Size', 'Max Length'].map(
      (key) => boxOf(rowOf(container, key).control).height
    );
    expect(heights).toEqual([28, 28, 28, 28]);
  });

  it('привязка набрана тем же кеглем, что и остальные поля', async () => {
    const container = await mountInDock();

    const sizes = [BINDING, 'Label', 'Size'].map(
      (key) => getComputedStyle(rowOf(container, key).control as HTMLElement).fontSize
    );
    expect(sizes).toEqual(['12px', '12px', '12px']);
    // И тем же шрифтом: моноширинным поле привязки было, пока оставалось полем ввода.
    const families = [BINDING, 'Label'].map(
      (key) => getComputedStyle(rowOf(container, key).control as HTMLElement).fontFamily
    );
    expect(families[0]).toBe(families[1]);
  });

  it('подпись стоит напротив текста поля, а не у верхнего края строки', async () => {
    const container = await mountInDock();

    const { label, control } = rowOf(container, 'Label');
    const text = boxOf(label);
    const field = boxOf(control);
    const middle = (box: DOMRect): number => box.top + box.height / 2;
    expect(Math.abs(middle(text) - middle(field))).toBeLessThanOrEqual(1);
  });

  it('узкий док: строка не вылезает за панель, а подпись обрезается', async () => {
    // Наименьшая ширина правого дока. Перенос подписи сделал бы строки разной высоты,
    // поэтому она обрезается многоточием, а полный текст остаётся подсказкой браузера.
    const container = await mountInDock(200);
    const edge = container.getBoundingClientRect().right;

    for (const key of ROWS) {
      const { label, control } = rowOf(container, key);
      expect(boxOf(control).right, key).toBeLessThanOrEqual(edge);
      expect(boxOf(control).width, key).toBeGreaterThan(60);
      expect(label.title, key).toBe(key);
      expect(boxOf(label).height, key).toBeLessThan(20);
    }
  });

  it('широкий док отдаёт место полю: колонка подписей не растёт вместе с ним', async () => {
    const container = await mountInDock(640);

    const { control } = rowOf(container, 'Label');
    const panel = container.getBoundingClientRect();
    // Девять rem — потолок колонки подписей; всё остальное досталось полю.
    expect(boxOf(control).left - panel.left).toBeLessThan(170);
    expect(boxOf(control).width).toBeGreaterThan(440);
  });
});

describe('булевы свойства — списком с мультивыбором', () => {
  /** Открывает список флагов и отдаёт его пункт по ключу свойства. */
  async function openFlags(container: HTMLElement): Promise<(key: string) => HTMLElement> {
    const { control } = rowOf(container, FLAGS);
    if (control === null) throw new Error('списка флагов нет');
    await userEvent.click(control);
    await expect.poll(() => control.getAttribute('aria-expanded')).toBe('true');
    return (key) => {
      const option = document.querySelector<HTMLElement>(`[data-testid="inspector-flags-${key}"]`);
      if (option === null) throw new Error(`пункта «${key}» в списке нет`);
      return option;
    };
  }

  it('флажков в панели нет: булевы свойства секции — один список', async () => {
    const { container } = await mount();

    expect(container.querySelector('[role="checkbox"], input[type="checkbox"]')).toBeNull();
    expect(container.querySelector('[role="radio"], input[type="radio"]')).toBeNull();
    // Отдельных строк у булевых свойств нет — они пункты списка.
    expect(labelOf(container, 'Required')).toBeNull();
    const option = await openFlags(container);
    expect(['required', 'readOnly', 'clearable'].map((key) => option(key).textContent)).toEqual([
      'Required',
      'Read Only',
      'Clearable',
    ]);
  });

  it('выбранный пункт включает свойство, снятый — убирает его из узла', async () => {
    const { container, session } = await mount();
    const option = await openFlags(container);
    expect(propsOf(session).required).toBeUndefined();

    await userEvent.click(option('required'));

    await expect.poll(() => propsOf(session).required).toBe(true);
    expect(option('required').getAttribute('aria-selected')).toBe('true');
    // Соседний флаг той же секции не тронут: пишется одно свойство, а не весь список.
    expect('readOnly' in propsOf(session)).toBe(false);

    await userEvent.click(option('required'));

    // Не `false`: выключено оно и по умолчанию, и лишняя строка в файле ни к чему.
    await expect.poll(() => 'required' in propsOf(session)).toBe(false);
  });

  it('свойство, включённое китом по умолчанию, показано включённым и выключается явно', async () => {
    const { container, session } = await mount();
    const { control } = rowOf(container, FLAGS);
    // В файле свойства нет, а действует оно — и в списке стоит выбранным.
    expect('clearable' in propsOf(session)).toBe(false);
    expect(control?.textContent).toContain('Clearable');
    const option = await openFlags(container);
    expect(option('clearable').getAttribute('aria-selected')).toBe('true');

    await userEvent.click(option('clearable'));

    // Убрать свойство мало — вернулось бы умолчание. Выключенное пишется как `false`.
    await expect.poll(() => propsOf(session).clearable).toBe(false);

    await userEvent.click(option('clearable'));

    await expect.poll(() => 'clearable' in propsOf(session)).toBe(false);
  });

  it('описания флагов собраны в подсказку списка', async () => {
    const { container } = await mount();

    const { control } = rowOf(container, FLAGS);

    // У пункта списка своей подсказки нет; флаг без описания в подсказку не попадает.
    expect(describedText(control)).toBe(
      'Required — Поле обязательно; Clearable — Крестик сброса значения'
    );
  });
});

describe('привязка к модели — список кита с вводом своего пути', () => {
  /** Привязка выделенного узла, как она записана в модели документа; `undefined` — снята. */
  function bindingOf(session: SchemaSession): unknown {
    let node: unknown = session.get().model;
    for (const step of SELECT_PATH) node = (node as Record<string | number, unknown>)[step];
    return (node as { model?: unknown }).model;
  }

  /** Открывает список привязки и отдаёт поиск по его пунктам: пункт находится по тексту. */
  async function openBinding(container: HTMLElement): Promise<(text: string) => HTMLElement> {
    const { control } = rowOf(container, BINDING);
    if (control === null) throw new Error('поля привязки нет');
    await userEvent.click(control);
    await expect.poll(() => control.getAttribute('aria-expanded')).toBe('true');
    return (text) => {
      const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
        (item) => item.textContent?.includes(text) === true
      );
      if (option === undefined) throw new Error(`пункта «${text}» в списке нет`);
      return option;
    };
  }

  it('поле — комбобокс кита, а не ввод с родным списком браузера', async () => {
    const { container } = await mount();

    const { control } = rowOf(container, BINDING);

    // Родной `datalist` рисует браузер — рядом со списками кита он и выглядел чужим.
    expect(container.querySelector('datalist')).toBeNull();
    expect(control?.tagName).toBe('BUTTON');
    expect(control?.getAttribute('role')).toBe('combobox');
    // Тот же вид, что у списка флагов по соседству: кнопка-триггер одного компонента кита.
    expect(control?.getAttribute('data-slot')).toBe(
      rowOf(container, FLAGS).control?.getAttribute('data-slot')
    );
    // Привязка узла стоит в поле как есть, без обёртки `$model(...)`.
    expect(control?.textContent).toBe('loanType');
  });

  it('список — пути, объявленные в форме; свой отмечен галочкой', async () => {
    const { container, session } = await mount();
    const option = await openBinding(container);
    expect(
      Array.from(document.querySelectorAll('[role="option"]')).map((item) => item.textContent)
    ).toEqual(['loanType', 'loanAmount', 'properties']);
    // Текущее значение видно в списке, как у любого списка панели.
    const checked = (text: string): string =>
      getComputedStyle(option(text).querySelector('svg') as SVGElement).opacity;
    expect(['loanType', 'loanAmount', 'properties'].map(checked)).toEqual(['1', '0', '0']);

    await userEvent.click(option('loanAmount'));

    await expect.poll(() => bindingOf(session)).toBe('$model(loanAmount)');
    expect(rowOf(container, BINDING).control?.textContent).toBe('loanAmount');
  });

  it('новый путь вводится в поиске и попадает в документ одной правкой', async () => {
    const { container, session } = await mount();
    const option = await openBinding(container);
    const search = document.querySelector<HTMLInputElement>('[cmdk-input]');
    if (search === null) throw new Error('поля поиска в списке нет');
    // Подсказка поиска — из словаря плагина: она говорит, что сюда же пишется новый путь.
    expect(search.placeholder).toBe('inspector.binding.search');

    await userEvent.fill(search, 'contact.phone');

    // Пока путь набирается, документ не тронут: недописанная привязка в него не попадает.
    await expect.poll(() => option('contact.phone')).toBeDefined();
    expect(bindingOf(session)).toBe('$model(loanType)');

    await userEvent.click(option('contact.phone'));

    await expect.poll(() => bindingOf(session)).toBe('$model(contact.phone)');
    expect(rowOf(container, BINDING).control?.textContent).toBe('contact.phone');
  });

  it('щелчок по уже выбранному пути документ не трогает', async () => {
    const { container, session } = await mount();
    const { control } = rowOf(container, BINDING);
    const option = await openBinding(container);
    const before = session.get().model;

    await userEvent.click(option('loanType'));

    // Список закрылся, а правки не было: пустой шаг в истории отмены ни к чему.
    await expect.poll(() => control?.getAttribute('aria-expanded')).toBe('false');
    expect(session.get().model).toBe(before);
    expect(bindingOf(session)).toBe('$model(loanType)');
  });

  it('крестика очистки нет: привязку меняют, а не снимают', async () => {
    // Узел без привязки модель считает контейнером, а контейнеру строка привязки не положена:
    // снятая привязка унесла бы строку целиком, и вернуть её из панели было бы нечем.
    const { container } = await mount();

    const { control } = rowOf(container, BINDING);

    expect(control?.parentElement?.querySelector('[data-slot="select-trailing"]')).toBeNull();
  });
});

describe('выпадающий список — того же кегля, что и поле', () => {
  const fontSizeOf = (element: Element | null): string => {
    if (element === null) throw new Error('элемента нет');
    return getComputedStyle(element).fontSize;
  };

  /** Раскрывает список строки и отдаёт её контрол; пункты после этого лежат в документе. */
  async function openList(container: HTMLElement, key: string): Promise<HTMLElement> {
    const { control } = rowOf(container, key);
    if (control === null) throw new Error(`контрола «${key}» в панели нет`);
    await userEvent.click(control);
    await expect.poll(() => control.getAttribute('aria-expanded')).toBe('true');
    await expect.poll(() => document.querySelectorAll('[role="option"]').length).not.toBe(0);
    return control;
  }

  // Поля панели сжаты классом до 12px, а список кит рисует в портале, где размер шрифта поля
  // не наследуется: пока пункты несли свои 14px, список раскрывался крупнее собственного поля.
  // Три строки — три устройства списка в ките: свой listbox в поповере, Radix Select и cmdk.
  it.each([
    ['список флагов', FLAGS],
    ['список выбора', 'Size'],
    ['привязка', BINDING],
  ])('%s: пункты набраны кеглем поля', async (_title, key) => {
    const { container } = await mount();

    const control = await openList(container, key);

    expect(fontSizeOf(control)).toBe('12px');
    const sizes = Array.from(document.querySelectorAll('[role="option"]')).map(fontSizeOf);
    expect([...new Set(sizes)]).toEqual(['12px']);
  });

  it('поле поиска в списке привязки — тем же кеглем, что и пункты', async () => {
    const { container } = await mount();

    await openList(container, BINDING);

    expect(fontSizeOf(document.querySelector('[cmdk-input]'))).toBe('12px');
  });
});

describe('отметка выбора — у правого края пункта', () => {
  /** Что измеряем у выбранного пункта: отступ подписи слева и место отметки справа. */
  interface Marked {
    /** От левого края пункта до начала подписи. */
    readonly labelOffset: number;
    /** От конца подписи до начала отметки: отрицательное — отметка стоит левее подписи. */
    readonly labelToMark: number;
    /** От конца отметки до правого края пункта. */
    readonly markGap: number;
  }

  /**
   * Выбранный пункт открытого списка — тот, чья отметка видна.
   *
   * По `aria-selected` его не найти: у списка на `cmdk` этот атрибут означает «под курсором»,
   * а не «выбран». Отметка же есть у всех трёх устройств: у выбранного она видима, у остальных
   * прозрачна либо не отрисована вовсе.
   */
  function measureMarked(): Marked {
    for (const option of document.querySelectorAll<HTMLElement>('[role="option"]')) {
      const mark = Array.from(option.querySelectorAll('svg')).find(
        (icon) => getComputedStyle(icon).opacity !== '0' && icon.getBoundingClientRect().width > 0
      );
      if (mark === undefined) continue;
      const walker = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
      let text = walker.nextNode();
      while (text !== null && (text.textContent ?? '').trim() === '') text = walker.nextNode();
      if (text === null) throw new Error('у выбранного пункта нет подписи');
      const range = document.createRange();
      range.selectNodeContents(text);
      const label = range.getBoundingClientRect();
      const item = option.getBoundingClientRect();
      const icon = mark.getBoundingClientRect();
      return {
        labelOffset: Math.round(label.left - item.left),
        labelToMark: Math.round(icon.left - label.right),
        markGap: Math.round(item.right - icon.right),
      };
    }
    throw new Error('выбранного пункта в открытом списке нет');
  }

  /** Раскрывает список строки и меряет его выбранный пункт. */
  async function openAndMeasure(container: HTMLElement, key: string): Promise<Marked> {
    const { control } = rowOf(container, key);
    if (control === null) throw new Error(`контрола «${key}» в панели нет`);
    await userEvent.click(control);
    await expect.poll(() => control.getAttribute('aria-expanded')).toBe('true');
    await expect.poll(() => document.querySelectorAll('[role="option"]').length).not.toBe(0);
    return measureMarked();
  }

  /** Панель с выбранным значением и у списка выбора: в образце размер не задан. */
  async function mountWithSize(): Promise<HTMLElement> {
    const { container, session } = await mount();
    const id = indexNodes(session.get().model).idAt(SELECT_PATH);
    if (id === undefined) throw new Error('в образце нет поля Select');
    session.apply(setPropOp(id, 'size', 'sm'));
    await expect.poll(() => rowOf(container, 'Size').control?.textContent).toBe('sm');
    return container;
  }

  // Три строки — три устройства списка в ките: свой listbox в поповере, Radix Select и cmdk.
  // У Radix отметка всегда стояла справа; два других рисовали её слева от подписи, и подписи
  // пунктов в соседних списках одной панели начинались с разного отступа.
  it.each([
    ['список флагов', FLAGS],
    ['список выбора', 'Size'],
    ['привязка', BINDING],
  ])('%s: отметка правее подписи и у края пункта', async (_title, key) => {
    const container = await mountWithSize();

    const marked = await openAndMeasure(container, key);

    expect(marked.labelToMark).toBeGreaterThanOrEqual(0);
    // Отступ пункта — восемь пикселей; отметка стоит вплотную к нему, а не посреди строки.
    expect(marked.markGap).toBeGreaterThanOrEqual(4);
    expect(marked.markGap).toBeLessThanOrEqual(10);
  });

  it('подписи пунктов всех трёх списков начинаются с одного отступа', async () => {
    const offsets: number[] = [];
    for (const key of [FLAGS, 'Size', BINDING]) {
      const container = await mountWithSize();
      offsets.push((await openAndMeasure(container, key)).labelOffset);
      unmount?.();
      unmount = undefined;
    }

    // Отметки слева больше нет ни у одного: подпись стоит сразу за отступом пункта.
    expect(offsets).toEqual([8, 8, 8]);
  });
});
