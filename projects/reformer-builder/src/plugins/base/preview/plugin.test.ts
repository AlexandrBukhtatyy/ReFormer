/**
 * Превью-хост: что он регистрирует и как ведёт канал выделения.
 *
 * Поверхностей у хоста нет — их вносят плагины стеков (`plugins/reformer/render`), — поэтому
 * здесь проверяется ровно то, чем он владеет: возможность живого вида, словарь и состояния.
 *
 * @module plugins/base/preview/plugin.test
 */

import { describe, expect, it } from 'vitest';
import type { PluginContext } from '@reformer/builder-plugin-api';
import { createPreviewPlugin, PREVIEW_PLUGIN_ID } from './plugin';
import { createPreviewSessions } from './state/sessions';
import { createFakeHostPort, fakeRef } from './testing';

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
  const registered: string[] = [];
  const commands: string[] = [];
  const locales: string[] = [];
  const ctx = {
    id: PREVIEW_PLUGIN_ID,
    subscriptions: [],
    // Словарь плагина — поле контекста: композиция его больше не раздаёт.
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      contribute: (locale: string) => locales.push(locale),
      onDidChangeLocale: () => ({ dispose: () => undefined }),
    },
    services: {
      get: (token: { id: string }) => services[token.id],
      require: (token: { id: string }) => services[token.id],
      register: (token: { id: string }) => {
        registered.push(token.id);
        return { dispose: () => undefined };
      },
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
  return { ctx, contributed, registered, commands, locales };
}

describe('activate', () => {
  it('отдаёт живой вид возможностью — и ни одного вклада: поверхности вносят стеки', () => {
    const { ctx, contributed, registered } = fakeContext();
    createPreviewPlugin({ host: createFakeHostPort() }).activate(ctx);
    expect(registered).toEqual(['reformer.preview.live']);
    // Ни поверхностей, ни панелей: чем рисовать схему — знание стека, а форма показывается
    // представлением редактора, а не полосой внизу экрана.
    expect(contributed).toEqual([]);
  });

  it('команд не регистрирует: переключать нечего, а показывать нечем', () => {
    const { ctx, commands } = fakeContext();
    createPreviewPlugin({ host: createFakeHostPort() }).activate(ctx);
    expect(commands).toEqual([]);
  });

  it('везёт словарь сам — в своё пространство имён, а не в общее', () => {
    const { ctx, locales } = fakeContext();
    createPreviewPlugin({ host: createFakeHostPort() }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('без службы выделения активируется молча: канал необязателен', () => {
    const { ctx } = fakeContext();
    expect(() => {
      createPreviewPlugin({ host: createFakeHostPort() }).activate(ctx);
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
    const { ctx } = fakeContext({ 'reformer.selection': selection.service });
    const sessions = createPreviewSessions();
    createPreviewPlugin({ host: createFakeHostPort(), sessions }).activate(ctx);

    // Так это выглядит со стороны поверхности: она зовёт `ctx.select`, тот пишет в состояние
    // документа, а состояние документа — это и есть стор реестра сеансов.
    sessions.storeFor(DOC.id).select(['n1']);

    expect(selection.writes).toContainEqual({ resource: DOC.id, ids: ['n1'] });
  });

  it('деактивация плагина перестаёт писать в чужой канал', () => {
    const selection = fakeSelectionService();
    const { ctx } = fakeContext({ 'reformer.selection': selection.service });
    const sessions = createPreviewSessions();
    createPreviewPlugin({ host: createFakeHostPort(), sessions }).activate(ctx);

    for (const subscription of ctx.subscriptions) subscription.dispose();
    selection.writes.length = 0;

    sessions.storeFor(DOC.id).select(['n2']);
    expect(selection.writes).toEqual([]);
  });

  it('без службы плагин не публикует, но состояние превью работает', () => {
    const { ctx } = fakeContext();
    const sessions = createPreviewSessions();
    createPreviewPlugin({ host: createFakeHostPort(), sessions }).activate(ctx);

    sessions.storeFor(DOC.id).select(['n1']);
    expect(sessions.storeFor(DOC.id).get().selection).toEqual(['n1']);
  });
});
