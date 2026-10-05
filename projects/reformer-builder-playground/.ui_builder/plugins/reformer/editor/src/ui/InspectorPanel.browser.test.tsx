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
 *   писал флажок.
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
import { createSessionRegistry, type SchemaSession } from '../session/sessions';
import { createFakeSchemaHost } from '../testing';
import { InspectorPanel } from './InspectorPanel';

const DOCUMENT = 'fake:form.json';

/** Поле «Тип кредита» образца — компонент `Select`. */
const SELECT_PATH = ['root', 'componentProps', 'steps', 0, 'children', 0] as const;

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
    makeNode: () => ({ value: '$model(x)', component: '$component(Select)' }),
  },
];

/** Подпись списка флагов: двойник словаря отдаёт ключ. */
const FLAGS = 'inspector.flags';

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
