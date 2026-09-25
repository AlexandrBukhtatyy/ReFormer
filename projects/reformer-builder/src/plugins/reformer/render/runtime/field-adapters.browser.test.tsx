/**
 * Поля превью на НАСТОЯЩЕМ ките: значение приходит в модель в своём типе, узел помечен токеном.
 *
 * Остальные тесты поверхностей идут на бедном двойнике хоста — namespace кита пуст, и форма
 * рисуется стабами. Здесь хост получает сам `@reformer/ui-kit` и его каталог, потому что оба
 * свойства ломались ровно на стыке превью и кита, куда двойник не достаёт:
 *
 * - **адаптер поля.** С 19.09 контролы кита несут диалект `value`/`onChange` статикой
 *   `reformerAdapter` (`defineFieldControl`). Превью оборачивает каждый компонент реестра
 *   границей ошибок (`./stubs`), рендерер ищет адаптер на обёртке — и если обёртка статику
 *   потеряла, `Input` пишет в модель DOM-событие, а `Checkbox` получает `value` вместо `checked`;
 * - **класс-токен узла.** По нему живой вид выбирает узел щелчком и подсвечивает выделенное;
 *   токен доезжает до DOM, только если компоненты кита отдают `className` своему корню.
 *
 * @module plugins/reformer/render/runtime/field-adapters.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as uiKit from '@reformer/ui-kit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinCatalog } from '@reformer/builder-stack-reformer/testing';
import type { KitNamespace } from '@reformer/builder-plugin-api';
import type {
  Disposable,
  DocumentRef,
  NodeId,
  PreviewContext,
  PreviewSurface,
  PreviewValues,
} from '@reformer/builder-plugin-api';
import { builtinSurfaces } from '../plugin';
import { decodeNodeToken, tokenFromClassName } from '../schema/node-token';
import { createFakeHost, fakeRef } from '../testing';
import { RUNTIME_SURFACE_ID } from './surface';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

/** Форма из контейнера и двух полей с разными диалектами контрола. */
const SCHEMA: JsonFormSchema = {
  root: {
    $nodeId: 'boxnode1',
    component: '$component(Box)',
    children: [
      {
        $nodeId: 'namenod1',
        value: '$model(name)',
        component: '$component(Input)',
        componentProps: { label: 'Имя', testId: 'name' },
      },
      {
        $nodeId: 'agreeno1',
        value: '$model(agree)',
        component: '$component(Checkbox)',
        componentProps: { label: 'Согласен', testId: 'agree' },
      },
    ],
  },
} as JsonFormSchema;

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

interface KeepingContext extends PreviewContext {
  kept(): PreviewValues | undefined;
}

/** Контекст, который по-настоящему хранит отданные значения. Схема — одна ссылка на все вызовы. */
function keepingContext(schema: JsonFormSchema): KeepingContext {
  const doc: DocumentRef = {
    id: 'fake:form/form.json',
    ref: fakeRef('fake:form/form.json'),
    kind: 'model',
    providerId: 'form.schema',
  };
  let values: PreviewValues | undefined;
  return {
    kept: () => values,
    doc,
    schema: () => schema,
    onDidChangeSchema: () => NOOP,
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => null,
    values: () => values,
    keepValues: (next) => {
      values = next;
    },
    report: () => undefined,
  };
}

/** Рантайм-поверхность, которой хост отдаёт настоящий встроенный кит. */
function runtimeWithKit(): PreviewSurface {
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
  return surface;
}

async function mounted(ctx: PreviewContext): Promise<{ element: HTMLElement; dispose(): void }> {
  const element = document.createElement('div');
  document.body.append(element);
  const subscription = runtimeWithKit().mount(element, ctx);
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    subscription.dispose();
  };
  cleanup.push(() => {
    dispose();
    element.remove();
  });
  await vi.waitFor(() => {
    expect(element.querySelector('[data-testid="input-name"]')).not.toBeNull();
  });
  return { element, dispose };
}

/** Узлы, чьи класс-токены есть в DOM поверхности, — тем же разбором, что у живого вида. */
function markedNodes(element: HTMLElement): Set<NodeId> {
  const ids = new Set<NodeId>();
  for (const node of element.querySelectorAll('[class*="rbnode-"]')) {
    const token = tokenFromClassName(typeof node.className === 'string' ? node.className : '');
    const id = token === null ? null : decodeNodeToken(token);
    if (id !== null) ids.add(id);
  }
  return ids;
}

describe('поля превью на встроенном ките', () => {
  it('ввод и щелчок кладут в модель строку и boolean, а не событие', async () => {
    const ctx = keepingContext(SCHEMA);
    const { element, dispose } = await mounted(ctx);

    const input = element.querySelector<HTMLInputElement>('[data-testid="input-name"]');
    const checkbox = element.querySelector<HTMLElement>('[data-testid="input-agree"]');
    expect(input).not.toBeNull();
    expect(checkbox).not.toBeNull();
    await userEvent.fill(input!, 'Аня');
    await userEvent.click(checkbox!);

    // Значения отдаёт очистка корня при снятии — микрозадачей (`../surface/mount`).
    dispose();
    await vi.waitFor(() => {
      expect(ctx.kept()).toBeDefined();
    });
    const kept = ctx.kept() as Record<string, unknown>;
    expect(kept.name).toBe('Аня');
    expect(kept.agree).toBe(true);
  });

  it('контейнер и оба поля помечены класс-токеном своего узла', async () => {
    const { element } = await mounted(keepingContext(SCHEMA));
    expect([...markedNodes(element)].sort()).toEqual(['agreeno1', 'boxnode1', 'namenod1']);
  });
});
