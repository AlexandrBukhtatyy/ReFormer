/**
 * Тесты плагина: состав вкладов, «за какой файл берётся редактор» и состояние вида.
 *
 * Порт платформы здесь подставной — настоящий собирается композицией и требует рабочей
 * области. Сам Monaco не поднимается ни разу: всё, что проверяется, принадлежит плагину,
 * а не движку.
 *
 * @module plugins/editor-monaco/plugin.test
 */

import { describe, expect, it } from 'vitest';
import {
  TextEditorFocusToken,
  type PluginContext,
  type ResourceRef,
  type TextEditorFocusRegistry,
} from '@/sdk';
import type { MonacoHost } from './host';
import { MONACO_EDITOR_PRIORITY } from './runtime/language';
import {
  createMonacoEditorPlugin,
  monacoEditorContribution,
  MONACO_EDITOR_ID,
  MONACO_PLUGIN_ID,
} from './plugin';
import { createViewStateRegistry } from './sync/view-state';

/**
 * Приоритет временного редактора на `textarea` из плагина файлов.
 *
 * Списан числом, а не импортирован: плагины друг друга не импортируют (проверяется линтером),
 * и это тот случай, когда копия константы — единственный способ выразить отношение «наш
 * приоритет больше».
 */
const TEXTAREA_EDITOR_PRIORITY = 1;

function ref(path: string, mediaType: string): ResourceRef {
  return { id: `fs:${path}`, sourceId: 'fs', path, name: path, kind: 'file', mediaType };
}

function fakeHost(overrides: Partial<MonacoHost> = {}): MonacoHost {
  return {
    useTranslate: () => (key: string) => key,
    useDiagnosticMessage: () => (key: string) => key,
    documentOf: () => null,
    writeText: () => Promise.resolve(),
    isTextual: (mediaType: string) =>
      mediaType.startsWith('text/') || mediaType === 'application/json',
    diagnostics: { get: () => [], onDidChange: () => ({ dispose: () => {} }) },
    ...overrides,
  };
}

/**
 * Подставной реестр фокуса. Настоящий — служба платформы, и плагин видит его только типом
 * из `@/sdk`; здесь проверяется, что плагин берёт ЧУЖОЙ реестр, а не заводит свой.
 */
function fakeFocus(): TextEditorFocusRegistry {
  return { isFocused: () => false, setFocused: () => {}, hasFocus: () => false };
}

function contribution() {
  return monacoEditorContribution({
    host: fakeHost(),
    focus: fakeFocus(),
    viewStates: createViewStateRegistry(),
  });
}

/** Проба здесь не нужна: `canOpen` решает по медиатипу и содержимого не читает. */
const probe = { text: () => Promise.resolve('') };

describe('вклад редактора', () => {
  it('берётся за всё, что читается текстом', () => {
    expect(contribution().canOpen(ref('a.ts', 'text/typescript'), probe)).toBe(
      MONACO_EDITOR_PRIORITY
    );
    expect(contribution().canOpen(ref('form.json', 'application/json'), probe)).toBe(
      MONACO_EDITOR_PRIORITY
    );
  });

  it('отказывается от двоичного ресурса', () => {
    expect(contribution().canOpen(ref('logo.png', 'image/png'), probe)).toBe(false);
  });

  it('вытесняет временный редактор на `textarea` приоритетом', () => {
    expect(MONACO_EDITOR_PRIORITY).toBeGreaterThan(TEXTAREA_EDITOR_PRIORITY);
  });

  it('содержимого не читает: проба остаётся нетронутой', () => {
    let read = 0;
    contribution().canOpen(ref('a.ts', 'text/typescript'), {
      text: () => {
        read += 1;
        return Promise.resolve('');
      },
    });
    expect(read).toBe(0);
  });
});

describe('состояние вида', () => {
  it('без записанного снимка отдаёт «нечего восстанавливать»', () => {
    expect(contribution().viewState?.capture('fs:a.ts')).toBeNull();
  });

  it('переживает круг «снять → вернуть»', () => {
    const viewStates = createViewStateRegistry();
    const editor = monacoEditorContribution({
      host: fakeHost(),
      focus: fakeFocus(),
      viewStates,
    });
    viewStates.record('fs:a.ts', { scrollTop: 40, scrollLeft: 0, line: 5, column: 2 });

    const snapshot = editor.viewState?.capture('fs:a.ts');
    viewStates.forget('fs:a.ts');
    editor.viewState?.restore('fs:a.ts', snapshot);

    expect(viewStates.peek('fs:a.ts')).toEqual({
      scrollTop: 40,
      scrollLeft: 0,
      line: 5,
      column: 2,
    });
  });

  it('непонятный снимок не восстанавливается и не роняет открытие', () => {
    const viewStates = createViewStateRegistry();
    const editor = monacoEditorContribution({
      host: fakeHost(),
      focus: fakeFocus(),
      viewStates,
    });
    expect(() => {
      editor.viewState?.restore('fs:a.ts', { чужое: 'значение' });
    }).not.toThrow();
    expect(viewStates.peek('fs:a.ts')).toBeNull();
  });
});

describe('createMonacoEditorPlugin', () => {
  function fakeContext() {
    const contributed: { point: string; id: string | undefined }[] = [];
    const locales: string[] = [];
    const required: string[] = [];
    const subscriptions: { dispose: () => void }[] = [];
    const ctx = {
      id: MONACO_PLUGIN_ID,
      subscriptions,
      i18n: {
        contribute: (locale: string) => {
          locales.push(locale);
        },
      },
      // Службы Host: реестр фокуса композиция регистрирует до активации плагинов.
      services: {
        require: (token: { id: string }) => {
          required.push(token.id);
          return fakeFocus();
        },
      },
      extensions: {
        contribute: (point: { id: string }, _value: unknown, meta?: { id?: string }) => {
          contributed.push({ point: point.id, id: meta?.id });
          return { dispose: () => {} };
        },
      },
    } as unknown as PluginContext;
    return { ctx, contributed, locales, required, subscriptions };
  }

  it('вносит редактор в точку расширения и кладёт снятие в подписки', () => {
    const { ctx, contributed, subscriptions } = fakeContext();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    expect(contributed).toEqual([{ point: 'editor', id: MONACO_EDITOR_ID }]);
    expect(subscriptions).toHaveLength(1);
  });

  it('везёт словарь сам: обе локали уходят в приёмник', () => {
    const { ctx, locales } = fakeContext();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('регистрирует словарь через подставленный приёмник, когда своего у контекста нет', () => {
    const locales: string[] = [];
    const ctx = {
      id: MONACO_PLUGIN_ID,
      subscriptions: [],
      extensions: { contribute: () => ({ dispose: () => {} }) },
    } as unknown as PluginContext;

    createMonacoEditorPlugin({
      host: fakeHost(),
      focus: fakeFocus(),
      i18n: {
        contribute: (locale: string) => {
          locales.push(locale);
        },
      },
    }).activate(ctx);

    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('пользуется ОБЩИМ реестром фокуса из опции, а не заводит свой', () => {
    const { ctx, required } = fakeContext();
    const plugin = createMonacoEditorPlugin({ host: fakeHost(), focus: fakeFocus() });
    expect(plugin.id).toBe(MONACO_PLUGIN_ID);
    plugin.activate(ctx);
    // Реестр дан значением — службу плагин не спрашивает: второй объект был бы вторым ответом
    // на вопрос «печатает ли человек», и рабочая область его бы не увидела.
    expect(required).toEqual([]);
  });

  it('без опции берёт реестр фокуса из службы платформы — той же, что читает рабочая область', () => {
    const { ctx, required } = fakeContext();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    expect(required).toEqual([TextEditorFocusToken.id]);
  });

  it('на активации ничего не грузит: Monaco приходит с первым открытым файлом', () => {
    const { ctx } = fakeContext();
    const before = Date.now();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    // Синхронная активация — часть контракта плагина; загрузка чанка её бы не пережила.
    expect(Date.now() - before).toBeLessThan(1000);
  });
});
