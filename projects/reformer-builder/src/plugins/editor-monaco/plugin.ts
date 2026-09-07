/**
 * Плагин редактора Monaco: вклад в точку редакторов и всё, что ему для этого нужно.
 *
 * **Почему это плагин, а не часть Host.** Редактор кода — предметное решение: какой движок,
 * какие языки, какие сочетания. У корневого реестра вкладов метода `contribute` нет вовсе,
 * поэтому «редактор, внесённый самим Host» невыразим, и вопрос «откуда здесь Monaco» имеет
 * ответ — «его внёс `editor-monaco`».
 *
 * **Что плагин делает сам, а что получает.** Сам: идентификатор, словарь, приоритет, тело
 * редактора, состояние вида, разметку по диагностикам, связь с буфером. Получает: рабочую
 * область, службу диагностик и перевод — четырьмя глаголами через порт (см. `./host`).
 * Точку расширения редакторов он берёт прямо из `@/sdk`: она там уже есть, и подставлять
 * её параметром, как это вынужден делать плагин файлов, больше не нужно.
 *
 * **Почему фабрика, а не готовый объект.** `definePlugin` возвращает замороженный плагин,
 * а порт платформы известен только композиции. Тот же приём, что у `createFilesPlugin`:
 * `app/plugins.ts` собирает список функцией именно потому, что плагинам нужны части
 * композиции.
 *
 * @module plugins/editor-monaco/plugin
 */

import { createElement } from 'react';
import {
  definePlugin,
  EditorPoint,
  type EditorContribution,
  type Plugin,
  type ResourceId,
} from '@/sdk';
import { createFocusRegistry, type MonacoFocusRegistry } from './sync/focus';
import type { MessageSink, MonacoHost } from './host';
import { MONACO_EDITOR_PRIORITY } from './runtime/language';
import { contributeMessages, resolveMessageSink } from './messages';
import { MonacoEditorBody } from './ui/MonacoEditor';
import { createViewStateRegistry, readViewState, type ViewStateRegistry } from './sync/view-state';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const MONACO_PLUGIN_ID = 'editor-monaco';

/** Идентификатор вклада редактора: ключ состояния вида и адрес в диагностике. */
export const MONACO_EDITOR_ID = 'editor.monaco';

export interface MonacoEditorPluginOptions {
  /** Порт платформы. Подставляется композицией — см. `./host`. */
  readonly host: MonacoHost;
  /**
   * Реестр фокуса.
   *
   * Тот же объект обязан достаться рабочей области (`createModelDocument({ isTextEditorFocused })`),
   * иначе перерисовка буфера по модели будет затирать набранное. Плагин создаст свой, если
   * его не дали, — но тогда ответ на вопрос «в фокусе ли редактор» никто, кроме него, не увидит.
   */
  readonly focus?: MonacoFocusRegistry;
  /** Реестр снимков вида. Обычно создаётся плагином; параметр — ради тестов. */
  readonly viewStates?: ViewStateRegistry;
  /**
   * Приёмник словаря — на случай, если в контексте плагина ещё нет штатного `i18n`
   * (см. `./messages`). Когда поле в контексте появится, параметр перестанет использоваться.
   */
  readonly i18n?: MessageSink;
}

/**
 * Вклад редактора.
 *
 * `canOpen` отвечает по медиатипу и содержимого не читает: этот редактор берётся за всё,
 * что читается текстом, а разбор нужен тем, кто решает по содержимому. Приоритет —
 * {@link MONACO_EDITOR_PRIORITY}, то есть больше временного редактора на `textarea`
 * из плагина файлов; при равенстве победил бы тот, кто раньше в реестре, и порядок
 * активации плагинов стал бы значимым.
 *
 * `viewState` отдаёт снимок, записанный редактором ПО ХОДУ ДЕЛА: оболочка зовёт `capture`
 * в уборке эффекта раскладки, когда тело уже могло быть размонтировано, а экземпляр Monaco
 * освобождён. Подробнее — в `./view-state`.
 */
export function monacoEditorContribution(options: {
  readonly host: MonacoHost;
  readonly focus: MonacoFocusRegistry;
  readonly viewStates: ViewStateRegistry;
}): EditorContribution {
  const { host, focus, viewStates } = options;
  return {
    id: MONACO_EDITOR_ID,
    // Имя для меню «открыть с помощью». Ключ разрешается словарём ЭТОГО плагина: `editor.label`
    // у другого плагина — другая строка, и общего пространства имён у словарей нет.
    titleKey: 'editor.label',
    canOpen: (ref) => (host.isTextual(ref.mediaType) ? MONACO_EDITOR_PRIORITY : false),
    Body: ({ documentId }: { documentId: ResourceId }) =>
      createElement(MonacoEditorBody, { host, focus, viewStates, documentId }),
    viewState: {
      capture: (id) => viewStates.peek(id),
      restore: (id, state) => {
        // Непонятное значение равносильно отсутствию снимка: редактор откроется сверху,
        // а не упадёт на чужой структуре.
        const restored = readViewState(state);
        if (restored !== null) viewStates.record(id, restored);
      },
    },
  };
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует: ни Monaco, ни его чанк здесь не грузятся — это делает
 * тело редактора при первом открытии файла (см. `./monaco-setup`). Плагин, тянущий
 * мегабайты на активации, замедлял бы запуск оболочки ради вкладки, которую могут
 * и не открыть.
 */
export function createMonacoEditorPlugin(options: MonacoEditorPluginOptions): Plugin {
  const host = options.host;
  const focus = options.focus ?? createFocusRegistry();
  const viewStates = options.viewStates ?? createViewStateRegistry();

  return definePlugin({
    id: MONACO_PLUGIN_ID,
    activate(ctx) {
      const sink = resolveMessageSink(ctx, options.i18n);
      if (sink !== null) contributeMessages(sink);

      ctx.subscriptions.push(
        ctx.extensions.contribute(
          EditorPoint,
          monacoEditorContribution({ host, focus, viewStates }),
          {
            id: MONACO_EDITOR_ID,
          }
        )
      );
    },
  });
}
