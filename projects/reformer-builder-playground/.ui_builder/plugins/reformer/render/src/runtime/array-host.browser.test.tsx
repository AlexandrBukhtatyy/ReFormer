/**
 * Массив с явным компонентом в превью на НАСТОЯЩЕМ ките.
 *
 * Узел массива без `component` рендерер рисует сам: строки по шаблону, без заголовка и кнопок.
 * Встроенные шаблоны и эталонная форма записывают массив с `component: $component(FieldArray)` —
 * тогда его рисует компонент кита. Пока реестр превью этого имени не знал, на месте массива
 * стояла заглушка «неизвестный компонент», хотя собранный модуль формы рисовал его нормально.
 * Здесь закреплено, что превью показывает то же, что и модуль: заголовок, «добавить» и строку.
 *
 * @module plugins/reformer/render/runtime/array-host.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as uiKit from '@reformer/ui-kit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinCatalog } from '../../../core/testing';
import type {
  Disposable,
  DocumentRef,
  KitNamespace,
  NodeId,
  PreviewContext,
  PreviewValues,
} from '@reformer/builder-plugin-api';
import { builtinSurfaces } from '../plugin';
import { createFakeHost, fakeRef } from '../testing';
import { RUNTIME_SURFACE_ID } from './surface';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

/** Массив рекомендателей: компонент кита, строка-шаблон из одного поля. */
const SCHEMA = {
  format: 2,
  root: {
    $nodeId: 'boxnode1',
    component: '$component(Box)',
    children: [
      {
        $nodeId: 'arraynd1',
        selector: 'references',
        model: '$model(references)',
        component: '$component(FieldArray)',
        componentProps: {
          title: 'Рекомендатели',
          addButtonLabel: '+ Добавить рекомендателя',
          emptyMessage: 'Рекомендателей пока нет',
        },
        initialValue: { name: '' },
        item: {
          $template: {
            $nodeId: 'rownode1',
            model: '$model(name)',
            component: '$component(Input)',
            componentProps: { label: 'Имя', testId: 'reference-name' },
          },
        },
      },
    ],
  },
} as unknown as JsonFormSchema;

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

function context(schema: JsonFormSchema): PreviewContext {
  const doc: DocumentRef = {
    id: 'fake:form/form.json',
    ref: fakeRef('fake:form/form.json'),
    kind: 'model',
    providerId: 'form.schema',
  };
  let values: PreviewValues | undefined;
  return {
    doc,
    schema: () => schema,
    onDidChangeSchema: () => NOOP,
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    // Пустой массив на входе: строку добавляет сам тест.
    mock: () => ({ model: { references: [] }, dataSources: {} }),
    values: () => values,
    keepValues: (next) => {
      values = next;
    },
    report: () => undefined,
  };
}

async function mounted(ctx: PreviewContext): Promise<HTMLElement> {
  const built = builtinCatalog();
  const host = createFakeHost({
    catalog: built.entries,
    descriptor: built.descriptor,
    namespace: uiKit as unknown as KitNamespace,
  });
  const surface = builtinSurfaces(host, (key) => key).find(
    (candidate) => candidate.id === RUNTIME_SURFACE_ID
  );
  if (surface === undefined) throw new Error('рантайм-поверхность не зарегистрирована');

  const element = document.createElement('div');
  document.body.append(element);
  const subscription = surface.mount(element, ctx);
  cleanup.push(() => {
    subscription.dispose();
    element.remove();
  });
  await vi.waitFor(() => {
    expect(element.textContent).toContain('Рекомендатели');
  });
  return element;
}

function addButton(element: HTMLElement): HTMLButtonElement {
  const button = [...element.querySelectorAll('button')].find((candidate) =>
    (candidate.textContent ?? '').includes('Добавить рекомендателя')
  );
  if (button === undefined) throw new Error('кнопка «Добавить рекомендателя» не найдена');
  return button;
}

describe('массив с явным компонентом в превью на встроенном ките', () => {
  it('рисуется компонентом кита, а не заглушкой: заголовок, пустое состояние, «добавить»', async () => {
    const element = await mounted(context(SCHEMA));

    expect(element.textContent).toContain('Рекомендателей пока нет');
    expect(element.textContent).not.toContain('предпросмотр ограничен');
    expect(element.textContent).not.toContain('FieldArray');
    expect(addButton(element)).toBeDefined();
  });

  it('«добавить» кладёт строку по шаблону узла', async () => {
    const element = await mounted(context(SCHEMA));
    expect(element.querySelector('[data-testid="input-reference-name"]')).toBeNull();

    await userEvent.click(addButton(element));

    await vi.waitFor(() => {
      expect(element.querySelector('[data-testid="input-reference-name"]')).not.toBeNull();
    });
  });
});
