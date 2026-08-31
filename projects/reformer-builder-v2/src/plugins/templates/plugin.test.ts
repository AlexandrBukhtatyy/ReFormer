/**
 * Плагин: состав вкладов и видимость панели.
 *
 * Порт платформы подставной — настоящий собирается композицией и требует рабочей области.
 *
 * @module plugins/templates/plugin.test
 */

import { describe, expect, it } from 'vitest';
import type { PluginContext, WhenContext } from '@/sdk';
import type { TemplateStore } from './contract';
import {
  createTemplatesPlugin,
  panelVisible,
  templatesPanel,
  TEMPLATES_PANEL_ID,
  TEMPLATES_PLUGIN_ID,
} from './plugin';
import { createTemplatesRefresh } from './refresh';
import { createFakeTemplatesHost } from './testing';

function whenContext(patch: Partial<WhenContext> = {}): WhenContext {
  return {
    focus: 'canvas',
    activeEditorId: null,
    activeResourceKind: null,
    hasSelection: false,
    previewMode: null,
    ...patch,
  };
}

function fakeContext() {
  const contributed: { point: string; id?: string; value: unknown }[] = [];
  const ctx = {
    id: TEMPLATES_PLUGIN_ID,
    subscriptions: [],
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id, value });
        return { dispose: () => undefined };
      },
      get: () => [],
      observe: () => ({ dispose: () => undefined }),
    },
    commands: {
      register: () => ({ dispose: () => undefined }),
      execute: () => Promise.resolve(true),
    },
    // Реестр служб отвечает «их нет»: без запросов к человеку пункт контекстного меню
    // просто недоступен — законная сборка, а не поломка активации.
    services: {
      get: () => undefined,
      require: () => {
        throw new Error('служба не зарегистрирована');
      },
    },
  } as unknown as PluginContext;
  return { ctx, contributed };
}

describe('activate', () => {
  it('вносит три хранилища вкладами — наравне с любым чужим', () => {
    const { ctx, contributed } = fakeContext();
    createTemplatesPlugin({ host: createFakeTemplatesHost() }).activate(ctx);
    const stores = contributed.filter((item) => item.point === 'templates.store');
    expect(stores.map((item) => item.id)).toEqual([
      'templates.store.builtin',
      'templates.store.project',
      'templates.store.local',
    ]);
    expect(stores.map((item) => (item.value as TemplateStore).source)).toEqual([
      'builtin',
      'project',
      'local',
    ]);
  });

  it('вклад уходит в ТУ точку, которую дала композиция', () => {
    const { ctx, contributed } = fakeContext();
    createTemplatesPlugin({
      host: createFakeTemplatesHost(),
      storePoint: { id: 'templates.store.v2' },
    }).activate(ctx);
    expect(contributed.filter((item) => item.point === 'templates.store.v2')).toHaveLength(3);
  });

  it('вносит панель', () => {
    const { ctx, contributed } = fakeContext();
    createTemplatesPlugin({ host: createFakeTemplatesHost() }).activate(ctx);
    expect(contributed.at(-1)).toMatchObject({ point: 'panel', id: TEMPLATES_PANEL_ID });
  });

  it('без печатника встроенное хранилище объявляет себя недоступным', () => {
    const { ctx, contributed } = fakeContext();
    createTemplatesPlugin({ host: createFakeTemplatesHost() }).activate(ctx);
    const builtin = contributed.find((item) => item.id === 'templates.store.builtin');
    expect((builtin?.value as TemplateStore).available()).toBe(false);
  });

  it('без локального хранилища локальный бэкенд недоступен, а остальные работают', () => {
    const { ctx, contributed } = fakeContext();
    createTemplatesPlugin({ host: createFakeTemplatesHost() }).activate(ctx);
    const byId = new Map(contributed.map((item) => [item.id, item.value as TemplateStore]));
    expect(byId.get('templates.store.local')?.available()).toBe(false);
    expect(byId.get('templates.store.project')?.available()).toBe(true);
  });

  it('везёт словарь сам, если есть куда его положить', () => {
    const { ctx } = fakeContext();
    const locales: string[] = [];
    createTemplatesPlugin({
      host: createFakeTemplatesHost(),
      i18n: { contribute: (locale) => locales.push(locale) },
    }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });
});

describe('видимость панели', () => {
  it('видна всегда: вопрос «с чего начать» задают до открытия документа', () => {
    expect(panelVisible(whenContext())).toBe(true);
    expect(panelVisible(whenContext({ activeResourceKind: 'text/typescript' }))).toBe(true);
  });

  it('панель вносится один раз, слот задаёт композиция', () => {
    const panel = templatesPanel(
      createFakeTemplatesHost(),
      () => [],
      'panel.left',
      createTemplatesRefresh()
    );
    expect(panel.slot).toBe('panel.left');
    expect(panel.when).toBe(panelVisible);
  });

  it('панель несёт действия шапки: «Обновить» живёт в доке, а не первой строкой списка', () => {
    const panel = templatesPanel(
      createFakeTemplatesHost(),
      () => [],
      'panel.left',
      createTemplatesRefresh()
    );
    expect(panel.Actions).toBeTypeOf('function');
  });
});

describe('повод перечитать', () => {
  it('зовёт подписчиков и отпускает их по освобождению', () => {
    const refresh = createTemplatesRefresh();
    let calls = 0;
    const subscription = refresh.subscribe(() => {
      calls += 1;
    });

    refresh.request();
    expect(calls).toBe(1);

    subscription.dispose();
    refresh.request();
    expect(calls).toBe(1);
  });

  it('подписчик вправе отписаться прямо в обработчике', () => {
    const refresh = createTemplatesRefresh();
    const seen: string[] = [];
    const first = refresh.subscribe(() => {
      seen.push('first');
      first.dispose();
    });
    refresh.subscribe(() => seen.push('second'));

    refresh.request();

    // Второй слушатель обязан получить свой вызов: обход идёт по копии набора.
    expect(seen).toEqual(['first', 'second']);
  });
});
