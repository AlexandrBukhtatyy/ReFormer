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
  EditorViewStatesToken,
  TextEditorFocusToken,
  type EditorViewStateSlice,
  type PluginContext,
  type ResourceRef,
  type TextEditorFocusRegistry,
} from '@reformer/builder-plugin-api';
import type { MonacoHost } from './host';
import { MONACO_EDITOR_PRIORITY } from './runtime/language';
import {
  createMonacoEditorPlugin,
  monacoEditorContribution,
  MONACO_EDITOR_ID,
  MONACO_PLUGIN_ID,
} from './plugin';
import { viewStatesOver, type ViewStateRegistry } from './sync/view-state';

/** Хранилище оболочки в объёме среза: плагину в тесте взять его неоткуда. */
function fakeSlice(): EditorViewStateSlice {
  const states = new Map<string, unknown>();
  return {
    record: (id, value) => {
      states.set(id, value);
    },
    peek: (id) => states.get(id),
    forget: (id) => {
      states.delete(id);
    },
  };
}

/** Снимки вида этого редактора — типизированный вид на такой срез. */
function fakeViewStates(): ViewStateRegistry {
  return viewStatesOver(fakeSlice());
}

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
 * из `@reformer/builder-plugin-api`; здесь проверяется, что плагин берёт ЧУЖОЙ реестр, а не заводит свой.
 */
function fakeFocus(): TextEditorFocusRegistry {
  return { isFocused: () => false, setFocused: () => {}, hasFocus: () => false };
}

function contribution() {
  return monacoEditorContribution({
    host: fakeHost(),
    focus: fakeFocus(),
    viewStates: fakeViewStates(),
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
    const viewStates = fakeViewStates();
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
    const viewStates = fakeViewStates();
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
  function fakeContext(options: { onRegister?: (impl: unknown) => void } = {}) {
    const contributed: { point: string; id: string | undefined }[] = [];
    const contributedValues: unknown[] = [];
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
      // Службы Host: и реестр фокуса, и хранилище снимков вида оболочка регистрирует
      // до активации плагинов — обе объявлены в `platform/services/host-capabilities`.
      services: {
        require: (token: { id: string }) => {
          required.push(token.id);
          return token.id === EditorViewStatesToken.id
            ? { forEditor: () => fakeSlice() }
            : fakeFocus();
        },
        // Тело редактора уходит НАРУЖУ возможностью: его показывают соседи.
        register: (_token: unknown, impl: unknown) => {
          options.onRegister?.(impl);
          return { dispose: () => {} };
        },
      },
      extensions: {
        contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
          contributed.push({ point: point.id, id: meta?.id });
          contributedValues.push(value);
          return { dispose: () => {} };
        },
      },
    } as unknown as PluginContext;
    return { ctx, contributed, contributedValues, locales, required, subscriptions };
  }

  it('вносит редактор в точку расширения и отдаёт его тело наружу возможностью', () => {
    const { ctx, contributed, subscriptions } = fakeContext();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    expect(contributed).toEqual([{ point: 'editor', id: MONACO_EDITOR_ID }]);
    // Две подписки: вклад в точку редакторов и занятый слот возможности. Обе снимаются
    // вместе с плагином — выключенный Monaco не должен оставлять за собой ни того, ни другого.
    expect(subscriptions).toHaveLength(2);
  });

  it('тело редактора у вклада и у возможности — ОДНА ссылка', () => {
    // React сравнивает тип элемента по ссылке. Раньше вкладов было два — один собирала
    // композиция для соседей, второй плагин вносил в точку, — и «тот же редактор» в режиме
    // «рядом» держался на том, что это разные вкладки.
    const registered: unknown[] = [];
    const { ctx, contributedValues } = fakeContext({ onRegister: (impl) => registered.push(impl) });
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);

    const contribution = contributedValues[0] as { Body: unknown };
    expect((registered[0] as { TextEditor: unknown }).TextEditor).toBe(contribution.Body);
  });

  it('везёт словарь сам: обе локали уходят в приёмник', () => {
    const { ctx, locales } = fakeContext();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('пользуется ОБЩИМ реестром фокуса из опции, а не заводит свой', () => {
    const { ctx, required } = fakeContext();
    const plugin = createMonacoEditorPlugin({ host: fakeHost(), focus: fakeFocus() });
    expect(plugin.id).toBe(MONACO_PLUGIN_ID);
    plugin.activate(ctx);
    // Реестр дан значением — службу фокуса плагин не спрашивает: второй объект был бы вторым
    // ответом на вопрос «печатает ли человек», и рабочая область его бы не увидела. Хранилище
    // снимков он спрашивает всё равно: значением ему его не давали.
    expect(required).toEqual([EditorViewStatesToken.id]);
  });

  it('без опции берёт реестр фокуса из службы платформы — той же, что читает рабочая область', () => {
    const { ctx, required } = fakeContext();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    expect(required).toEqual([TextEditorFocusToken.id, EditorViewStatesToken.id]);
  });

  it('на активации ничего не грузит: Monaco приходит с первым открытым файлом', () => {
    const { ctx } = fakeContext();
    const before = Date.now();
    createMonacoEditorPlugin({ host: fakeHost() }).activate(ctx);
    // Синхронная активация — часть контракта плагина; загрузка чанка её бы не пережила.
    expect(Date.now() - before).toBeLessThan(1000);
  });
});
