/**
 * Панель свойств узла — в настоящем браузере: подсказка свойства живёт значком у подписи.
 *
 * Модель панели (какие поля, в каком порядке, чем правятся) проверена у себя
 * (`../palette/inspector-model.test`). Здесь — то, чего в модели нет и что видно только
 * отрисованным: текст подсказки не стоит строкой под полем, значок есть ровно там, где есть что
 * сказать, по наведению он показывает текст, а контрол получает его через `aria-describedby`.
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
import { createSessionRegistry } from '../session/sessions';
import { createFakeSchemaHost } from '../testing';
import { InspectorPanel } from './InspectorPanel';

const DOCUMENT = 'fake:form.json';

/** Поле «Тип кредита» образца — компонент `Select`. */
const SELECT_PATH = ['root', 'componentProps', 'steps', 0, 'children', 0] as const;

/** По свойству на каждый вид контрола панели; `className` — без описания. */
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
      description: 'Поле обязательно',
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

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mount(): Promise<HTMLElement> {
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
  return mounted.container;
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

describe('подсказка свойства — значком у подписи', () => {
  it('текст подсказки не стоит строкой под полем', async () => {
    const container = await mount();

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
    const container = await mount();
    const { hint } = rowOf(container, 'Label');
    if (hint === null) throw new Error('значка подсказки нет');

    await userEvent.hover(hint);

    await expect
      .poll(() => document.querySelector('[role="tooltip"]')?.textContent ?? '')
      .toContain('Подпись поля');
  });

  it('значок есть у каждого вида контрола, включая флажок', async () => {
    const container = await mount();

    // Текст, список, число и флажок: у флажка подпись стоит рядом с контролом, а не над ним,
    // и раньше его описание не показывалось вовсе.
    for (const key of ['Label', 'Size', 'Max Length', 'Required']) {
      const { control, hint } = rowOf(container, key);
      expect(hint, key).not.toBeNull();
      expect(control, key).not.toBeNull();
      expect(control?.getAttribute('aria-describedby'), key).toBeTruthy();
    }
  });

  it('свойство без описания значка не получает', async () => {
    const container = await mount();

    const { control, hint } = rowOf(container, 'Class Name');

    expect(hint).toBeNull();
    // И ссылки на несуществующий текст у контрола нет.
    expect(control?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('свойство, которое правится только в JSON, говорит об этом значком', async () => {
    const container = await mount();

    const { control, hint } = rowOf(container, 'Options');

    expect(hint).not.toBeNull();
    const described = control?.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent).toBe('inspector.readonly');
  });

  it('значок стоит вне подписи: щелчок по нему контрол не трогает', async () => {
    const container = await mount();
    const { label, hint, control } = rowOf(container, 'Required');
    if (hint === null) throw new Error('значка подсказки нет');

    expect(label.contains(hint)).toBe(false);
    await userEvent.click(hint);

    expect(control?.getAttribute('aria-checked')).toBe('false');
  });
});
