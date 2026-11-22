/**
 * Метка незавершённой сборки в настоящем браузере (ReFormer-tv4z).
 *
 * Зависание само здесь не воспроизвести: повисший тест повесил бы и прогон. Проверяется то, на чём
 * держится выход из петли зависаний: метка стоит, пока форма собирается, и снимается после
 * отрисовки; оставшаяся с прошлой загрузки метка не даёт превью исполнить код формы само.
 *
 * @module plugins/reformer/render/compiling/stale-build.browser.test
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
} from '@reformer/builder-plugin-api';
import type { PreviewModules } from '../host';
import { builtinSurfaces } from '../plugin';
import { createFakeHost, createFakeModules, fakeRef } from '../testing';
import { INFLIGHT_PREFIX } from './inflight';
import { COMPILING_SURFACE_ID } from './surface';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);
const DOCUMENT = 'fake:form/schema/form.schema.json';
const MARK = `${INFLIGHT_PREFIX}${DOCUMENT}`;

const SCHEMA = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Почта', testId: 'email' },
      },
    ],
  },
} as unknown as JsonFormSchema;

const MODULE: Record<string, string> = {
  'form/model/initial-value.ts':
    'exports.createInitialValues = function () { return { email: "из модуля" }; };',
};

function context(): PreviewContext {
  const doc: DocumentRef = {
    id: DOCUMENT,
    ref: fakeRef(DOCUMENT),
    kind: 'model',
    providerId: 'form.schema',
  };
  return {
    doc,
    schema: () => SCHEMA,
    onDidChangeSchema: () => NOOP,
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => null,
    values: () => undefined,
    keepValues: () => undefined,
    report: () => undefined,
  };
}

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
  localStorage.removeItem(MARK);
});

/** Монтирует компилирующую поверхность над заданным загрузчиком модулей. */
function mount(modules: PreviewModules): HTMLElement {
  const built = builtinCatalog();
  const host = createFakeHost({
    catalog: built.entries,
    descriptor: built.descriptor,
    namespace: uiKit as unknown as KitNamespace,
    source: { executesCode: true },
    modules,
    tree: MODULE,
  });
  const surface = builtinSurfaces(host, (key) => key).find(
    (candidate) => candidate.id === COMPILING_SURFACE_ID
  );
  if (surface === undefined) throw new Error('компилирующая поверхность не зарегистрирована');
  const element = document.createElement('div');
  document.body.append(element);
  const subscription = surface.mount(element, context());
  cleanup.push(() => {
    subscription.dispose();
    element.remove();
  });
  return element;
}

const input = (element: HTMLElement): HTMLInputElement | null =>
  element.querySelector<HTMLInputElement>('[data-testid="input-email"]');

describe('метка незавершённой сборки в превью', () => {
  it('метка с прошлой загрузки: код формы не исполняется, пока человек не велит', async () => {
    // Прошлая загрузка страницы начала сборку и не закончила — вкладку убили.
    localStorage.setItem(MARK, JSON.stringify({ page: 'hung-page', at: 0 }));
    const modules = createFakeModules();
    const load = vi.spyOn(modules, 'load');

    const element = mount(modules);

    const retry = await vi.waitFor(() => {
      const button = element.querySelector<HTMLButtonElement>('[data-testid="preview-retry"]');
      expect(button).not.toBeNull();
      return button!;
    });
    expect(element.textContent).toContain('empty.stale-build');
    expect(load).not.toHaveBeenCalled();

    await userEvent.click(retry);

    await vi.waitFor(() => {
      expect(input(element)?.value).toBe('из модуля');
    });
    expect(load).toHaveBeenCalled();
    // Сборка дошла до отрисовки — метки не осталось.
    expect(localStorage.getItem(MARK)).toBeNull();
  });

  it('обычная сборка держит метку, пока идёт, и снимает после отрисовки формы', async () => {
    const real = createFakeModules();
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    // Загрузчик ждёт сигнала: сборка «идёт», сколько нужно тесту.
    const modules: PreviewModules = {
      load: async (...args) => {
        await gate;
        return real.load(...args);
      },
    };

    const element = mount(modules);

    await vi.waitFor(() => {
      expect(localStorage.getItem(MARK)).not.toBeNull();
    });
    expect(input(element)).toBeNull();

    open();

    await vi.waitFor(() => {
      expect(input(element)?.value).toBe('из модуля');
    });
    expect(localStorage.getItem(MARK)).toBeNull();
  });
});
