/**
 * Плагин: состав вкладов и возможности поверхностей.
 *
 * Порт платформы здесь подставной — настоящий собирается композицией и требует рабочей области.
 * Проверяется то, чем владеет плагин.
 *
 * @module plugins/preview/plugin.test
 */

import { describe, expect, it } from 'vitest';
import type { PluginContext } from '@/sdk';
import { chooseSurface } from './surface/selection';
import { builtinSurfaces, createPreviewPlugin, PREVIEW_PLUGIN_ID } from './plugin';
import { MODEL_PANEL_ID } from './ui/ModelPanel';
import { COMPILING_SURFACE_ID } from './compiling/surface';
import { RUNTIME_SURFACE_ID } from './runtime/surface';
import { createPreviewSessions } from './state/sessions';
import { createFakeHost, fakeRef } from './testing';

const DOC = {
  id: 'fake:form.json',
  ref: fakeRef('fake:form.json'),
  kind: 'model' as const,
};

/**
 * Реестры в объёме, который трогает `activate`.
 *
 * `services` присутствует всегда и по умолчанию ПУСТ: плагин обязан активироваться в сборке,
 * где службы выделения нет, — это и есть проверка того, что канал необязателен.
 */
function fakeContext(services: Readonly<Record<string, unknown>> = {}) {
  const contributed: { point: string; id?: string }[] = [];
  const commands: string[] = [];
  const ctx = {
    id: PREVIEW_PLUGIN_ID,
    subscriptions: [],
    services: {
      get: (token: { id: string }) => services[token.id],
      require: (token: { id: string }) => services[token.id],
      register: () => ({ dispose: () => undefined }),
    },
    extensions: {
      contribute: (point: { id: string }, _value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id });
        return { dispose: () => undefined };
      },
      get: () => [],
      observe: () => ({ dispose: () => undefined }),
    },
    commands: {
      register: (command: { id: string }) => {
        commands.push(command.id);
        return { dispose: () => undefined };
      },
      execute: () => Promise.resolve(true),
    },
  } as unknown as PluginContext;
  return { ctx, contributed, commands };
}

describe('activate', () => {
  it('вносит поверхности и ОДНУ панель — модель, которая форму не дублирует', () => {
    const { ctx, contributed } = fakeContext();
    createPreviewPlugin({ host: createFakeHost() }).activate(ctx);
    // Прежняя панель ушла вместе с переключателем: она показывала ФОРМУ, которую и так
    // показывает представление редактора схемы. Панель модели показывает то, чего не видно
    // нигде, — значения, состояние узлов и производные пути, — поэтому её возвращение
    // не откат прежнего решения, а другое решение.
    expect(contributed).toEqual([
      { point: 'panel', id: MODEL_PANEL_ID },
      { point: 'preview.surface', id: RUNTIME_SURFACE_ID },
      { point: 'preview.surface', id: COMPILING_SURFACE_ID },
    ]);
  });

  it('вклад уходит в ТУ точку, которую дала композиция', () => {
    const { ctx, contributed } = fakeContext();
    createPreviewPlugin({
      host: createFakeHost(),
      surfacePoint: { id: 'preview.surface.v2' },
    }).activate(ctx);
    expect(contributed.filter((item) => item.point === 'preview.surface.v2')).toHaveLength(2);
  });

  it('команд не регистрирует: переключать нечего, а показывать нечем', () => {
    const { ctx, commands } = fakeContext();
    createPreviewPlugin({ host: createFakeHost() }).activate(ctx);
    expect(commands).toEqual([]);
  });

  it('везёт словарь сам, если есть куда его положить', () => {
    const { ctx } = fakeContext();
    const locales: string[] = [];
    createPreviewPlugin({
      host: createFakeHost(),
      i18n: { contribute: (locale) => locales.push(locale) },
    }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('без службы выделения активируется молча: канал необязателен', () => {
    const { ctx } = fakeContext();
    expect(() => {
      createPreviewPlugin({ host: createFakeHost() }).activate(ctx);
    }).not.toThrow();
  });
});

describe('канал выделения', () => {
  /** Служба в объёме, который трогает плагин: одна запись по ресурсу. */
  function fakeSelectionService() {
    const writes: { resource: string; ids: readonly string[] }[] = [];
    return {
      writes,
      service: {
        get: () => [],
        set: (resource: string, ids: readonly string[]) => {
          writes.push({ resource, ids: [...ids] });
        },
        onDidChange: () => ({ dispose: () => undefined }),
        forget: () => undefined,
      },
    };
  }

  it('плагин берёт службу из реестра и публикует туда выбранный узел', () => {
    const selection = fakeSelectionService();
    const { ctx } = fakeContext({ 'host.selection': selection.service });
    const sessions = createPreviewSessions();
    createPreviewPlugin({ host: createFakeHost(), sessions }).activate(ctx);

    // Так это выглядит со стороны поверхности: она зовёт `ctx.select`, тот пишет в состояние
    // документа, а состояние документа — это и есть стор реестра сеансов.
    sessions.storeFor(DOC.id).select(['n1']);

    expect(selection.writes).toContainEqual({ resource: DOC.id, ids: ['n1'] });
  });

  it('деактивация плагина перестаёт писать в чужой канал', () => {
    const selection = fakeSelectionService();
    const { ctx } = fakeContext({ 'host.selection': selection.service });
    const sessions = createPreviewSessions();
    createPreviewPlugin({ host: createFakeHost(), sessions }).activate(ctx);

    for (const subscription of ctx.subscriptions) subscription.dispose();
    selection.writes.length = 0;

    sessions.storeFor(DOC.id).select(['n2']);
    expect(selection.writes).toEqual([]);
  });

  it('без службы плагин не публикует, но состояние превью работает', () => {
    const { ctx } = fakeContext();
    const sessions = createPreviewSessions();
    createPreviewPlugin({ host: createFakeHost(), sessions }).activate(ctx);

    sessions.storeFor(DOC.id).select(['n1']);
    expect(sessions.storeFor(DOC.id).get().selection).toEqual(['n1']);
  });
});

describe('возможности поверхностей', () => {
  it('исполняет код ровно одна — компилирующая', () => {
    const executing = builtinSurfaces(createFakeHost()).filter(
      (surface) => surface.capabilities.executesCode
    );
    expect(executing.map((surface) => surface.id)).toEqual([COMPILING_SURFACE_ID]);
  });

  it('исполняющая поверхность объявлена в том же realm: иначе второй экземпляр ядра', () => {
    for (const surface of builtinSurfaces(createFakeHost())) {
      expect(surface.capabilities.sameRealm).toBe(true);
    }
  });

  it('выбор узла кликом умеют все три', () => {
    for (const surface of builtinSurfaces(createFakeHost())) {
      expect(surface.capabilities.hitTest).toBe(true);
    }
  });
});

describe('запрет исполнения по источнику доходит до выбора', () => {
  it('на источнике без права исполнения компилирующая недоступна, показывается рантайм', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost()),
      doc: DOC,
      source: { executesCode: false },
    });
    expect(choice.surface?.id).toBe(RUNTIME_SURFACE_ID);
    expect(choice.fallback).toEqual({
      requested: COMPILING_SURFACE_ID,
      reason: 'source-forbids-code',
    });
  });

  it('с правом исполнения умолчание — компилирующая', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost()),
      doc: DOC,
      source: { executesCode: true },
    });
    expect(choice.surface?.id).toBe(COMPILING_SURFACE_ID);
  });
});
