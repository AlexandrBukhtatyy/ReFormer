/**
 * Панель «Модель» — в настоящем браузере: значение, которое показывает строка, — текущее
 * значение формы, а правка в панели доходит до модели.
 *
 * Поля значений неуправляемые, и устаревшее значение в них видно только отрисованным: модель
 * при этом верна, строки перерисовываются, а поле показывает то, что было при монтировании.
 *
 * Здесь же связь с выделением: узел, выделенный в схеме, подсвечивает строку своего пути, а
 * щелчок по пути выделяет узел.
 *
 * @module plugins/reformer/render/ui/ModelPanel.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createFormFromModel, createModel } from '@reformer/core';
import type { NodeId, ResourceId } from '@reformer/builder-plugin-api';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { ensureNodeIds, nodeIdOf, walkNodes } from '../../../core/form-model';
import { renderReact } from '../../../../.shared/render';
import type { PreviewHost } from '../host';
import { ModelPanel } from './ModelPanel';

interface Contact {
  contact: { name: string; email: string };
  age: number;
}

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

const DOCUMENT = 'fs:forms/contact/form.schema.json';
const NOOP = { dispose() {} };

/** Схема формы: у полей — идентификаторы узлов, по ним и идёт связь с выделением. */
function contactSchema(): JsonFormSchema {
  const field = (path: string, label: string) => ({
    model: `$model(${path})`,
    component: '$component(Input)',
    componentProps: { label },
  });
  let seq = 0;
  return ensureNodeIds(
    {
      root: {
        component: '$component(Box)',
        children: [
          field('contact.name', 'Name'),
          field('contact.email', 'Email'),
          field('age', 'Age'),
        ],
      },
    } as unknown as JsonFormSchema,
    () => `cn${String(seq++).padStart(6, '0')}`
  );
}

/** Узел поля по пути модели. */
function nodeOf(schema: JsonFormSchema, path: string): NodeId {
  let found: NodeId | undefined;
  walkNodes(schema, (node) => {
    if ((node as { model?: string }).model === `$model(${path})`) found = nodeIdOf(node);
  });
  if (found === undefined) throw new Error(`в схеме нет узла «${path}»`);
  return found;
}

/** Канал выделения — тот же контракт, что у службы оболочки. */
function selectionChannel() {
  const state = new Map<ResourceId, readonly NodeId[]>();
  const listeners = new Set<(resource: ResourceId) => void>();
  // Между изменениями — та же ссылка, как требует контракт: снимок читает useSyncExternalStore.
  const none: readonly NodeId[] = [];
  return {
    get: (resource: ResourceId) => state.get(resource) ?? none,
    set: (resource: ResourceId, ids: readonly NodeId[]) => {
      state.set(resource, ids);
      for (const listener of [...listeners]) listener(resource);
    },
    onDidChange: (cb: (resource: ResourceId) => void) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  };
}

function mount() {
  const model = createModel<Contact>({
    contact: { name: 'Ann', email: 'ann@example.com' },
    age: 30,
  });
  createFormFromModel({ model });
  const schema = contactSchema();
  const selection = selectionChannel();
  const host = {
    useTranslate: () => (key: string) => key,
    useActiveDocument: () => DOCUMENT,
    documentOf: () => ({ model: () => schema, onDidChangeContent: () => NOOP }),
    selection: () => selection,
  } as unknown as PreviewHost;
  const live = { formOf: () => ({ model }), onDidChangeForm: () => NOOP };
  const mounted = renderReact(<ModelPanel host={host} live={() => live as never} />);
  unmount = mounted.unmount;
  return { container: mounted.container, model, schema, selection };
}

/** Строка пути. */
function rowOf(container: HTMLElement, path: string): HTMLTableRowElement {
  const row = Array.from(container.querySelectorAll('tbody tr')).find(
    (candidate) => candidate.querySelector('td')?.textContent === path
  );
  if (row === undefined) throw new Error(`в панели нет строки «${path}»`);
  return row as HTMLTableRowElement;
}

/** Поле значения в строке пути. */
function inputOf(container: HTMLElement, path: string): HTMLInputElement {
  const input = rowOf(container, path).querySelector('input');
  if (input == null) throw new Error(`в панели нет поля «${path}»`);
  return input;
}

describe('панель «Модель»', () => {
  it('значение, сменившееся в форме, видно в поле панели', async () => {
    const { container, model } = mount();
    await vi.waitFor(() => expect(inputOf(container, 'contact.name').value).toBe('Ann'));

    model.contact.name = 'Bob';
    model.age = 31;

    await vi.waitFor(() => {
      expect(inputOf(container, 'contact.name').value).toBe('Bob');
      expect(inputOf(container, 'age').value).toBe('31');
    });
  });

  it('правка в панели доходит до модели на уходе из поля', async () => {
    const { container, model } = mount();
    const input = await vi.waitFor(() => inputOf(container, 'contact.email'));

    await userEvent.fill(input, 'bob@example.com');
    // До ухода из поля модель не меняется: набор в панели не перемонтирует поле.
    expect(model.contact.email).toBe('ann@example.com');
    expect(inputOf(container, 'contact.email')).toBe(input);
    await userEvent.click(inputOf(container, 'contact.name'));

    expect(model.contact.email).toBe('bob@example.com');
    await vi.waitFor(() =>
      expect(inputOf(container, 'contact.email').value).toBe('bob@example.com')
    );
  });
});

describe('панель «Модель» и выделение в схеме', () => {
  it('узел, выделенный в схеме, подсвечивает строку своего пути', async () => {
    const { container, schema, selection } = mount();
    await vi.waitFor(() => rowOf(container, 'contact.email'));
    expect(container.querySelector('tr[data-selected]')).toBeNull();

    selection.set(DOCUMENT, [nodeOf(schema, 'contact.email')]);

    await vi.waitFor(() =>
      expect(rowOf(container, 'contact.email').hasAttribute('data-selected')).toBe(true)
    );
    expect(container.querySelectorAll('tr[data-selected]')).toHaveLength(1);

    // Выделение другого документа панель не трогает.
    selection.set('fs:other.json', [nodeOf(schema, 'age')]);
    expect(rowOf(container, 'age').hasAttribute('data-selected')).toBe(false);
  });

  it('щелчок по пути выделяет его узел в схеме', async () => {
    const { container, schema, selection } = mount();
    const path = await vi.waitFor(() => rowOf(container, 'contact.name').querySelector('button'));
    expect(path).not.toBeNull();

    await userEvent.click(path!);

    expect(selection.get(DOCUMENT)).toEqual([nodeOf(schema, 'contact.name')]);
    await vi.waitFor(() =>
      expect(rowOf(container, 'contact.name').hasAttribute('data-selected')).toBe(true)
    );
  });

  it('у группы без узла в схеме путь — просто текст', async () => {
    const { container } = mount();
    await vi.waitFor(() => rowOf(container, 'contact'));
    expect(rowOf(container, 'contact').querySelector('td button')).toBeNull();
  });
});
