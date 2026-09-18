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
 * Точку расширения редакторов он берёт прямо из `@reformer/builder-plugin-api`: она там уже есть, и подставлять
 * её параметром, как это вынужден делать плагин файлов, больше не нужно.
 *
 * **Почему фабрика, а не готовый объект.** `definePlugin` возвращает замороженный плагин,
 * а порт платформы известен только композиции. Тот же приём, что у `createFilesPlugin`:
 * `app/plugins.ts` собирает список функцией именно потому, что плагинам нужны части
 * композиции.
 *
 * @module plugins/editor-monaco/plugin
 */

import { createElement, type ComponentType } from 'react';
import {
  defineCapability,
  definePlugin,
  EditorPoint,
  EditorViewStatesToken,
  TextEditorFocusToken,
  type EditorContribution,
  type Plugin,
  type ResourceId,
  type TextEditorFocusRegistry,
} from '@reformer/builder-plugin-api';
import type { MonacoHost } from './host';
import { MONACO_EDITOR_PRIORITY } from './runtime/language';
import { contributeMessages } from './messages';
import { MonacoEditorBody } from './ui/MonacoEditor';
import { readViewState, viewStatesOver, type ViewStateRegistry } from './sync/view-state';
import { MONACO_EDITOR_ID, MONACO_PLUGIN_ID } from './contract';

// Идентификаторы живут в `./contract` — отдельном листе графа: их берёт композиция,
// а импорт из этого модуля втянул бы в стартовый граф весь редактор вместе с Monaco.
export { MONACO_EDITOR_ID, MONACO_PLUGIN_ID };

/**
 * Тело текстового редактора как ВОЗМОЖНОСТЬ.
 *
 * Заведена ради соседей: предпросмотр markdown показывает исходник в режиме «рядом»,
 * а редактор схемы — в режиме исходника, и оба обязаны показывать ТОТ ЖЕ редактор,
 * в котором файл правится, а не его копию. Плагины друг друга не импортируют, поэтому
 * до недавнего времени тело раздавала композиция: она звала {@link monacoEditorContribution}
 * сама и передавала `Body` параметром двоим.
 *
 * У этого была цена, которую видно только в коде: вкладов получалось ДВА — один собирала
 * композиция для соседей, второй плагин вносил в точку редакторов, — и `Body` у них были
 * разными функциями. React сравнивает тип элемента по ссылке, поэтому «тот же редактор»
 * держался на том, что вкладка кода и режим «рядом» — разные вкладки. Теперь тело одно
 * на всех, и это утверждение кода, а не совпадение.
 *
 * Версия `1.0.0` — исходная: компонент, принимающий `documentId`.
 */
export const TextEditorCapability = defineCapability<TextEditorProvider>({
  id: 'reformer.editor',
  version: '1.0.0',
});

export interface TextEditorProvider {
  /** Тело редактора. Ссылка стабильна: её гарантирует провайдер, а не вызывающий. */
  readonly TextEditor: ComponentType<{ documentId: ResourceId }>;
}

export interface MonacoEditorPluginOptions {
  /** Порт платформы. Подставляется композицией — см. `./host`. */
  readonly host: MonacoHost;
  /**
   * Реестр фокуса текстового редактора — платформенный, см. `TextEditorFocusToken` в `@reformer/builder-plugin-api`.
   *
   * Тот же объект композиция регистрирует службой и отдаёт рабочей области
   * (`attachDocumentModel({ isTextEditorFocused })`): иначе перерисовка буфера по модели
   * затирала бы набранное. Опция нужна, потому что тело редактора одалживают markdown и
   * редактор схемы через {@link monacoEditorContribution} ДО активации плагина — то есть
   * до того, как у него есть `ctx.services`. Без опции плагин берёт службу при активации.
   * Своего реестра он не заводит: это был бы второй ответ на вопрос «печатает ли человек»,
   * которого рабочая область не увидит.
   */
  readonly focus?: TextEditorFocusRegistry;
  /**
   * Снимки вида. Обычно плагин надевает свой вид на хранилище оболочки
   * (`EditorViewStatesToken` в `@reformer/builder-plugin-api`); параметр — ради тестов и ради того же случая,
   * что у {@link focus}: тело редактора одалживают ДО активации плагина.
   */
  readonly viewStates?: ViewStateRegistry;
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
  readonly focus: TextEditorFocusRegistry;
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

  return definePlugin({
    id: MONACO_PLUGIN_ID,
    activate(ctx) {
      // Службы Host: композиция регистрирует их до активации любого плагина, поэтому `require`
      // здесь законен — правило «искать сервис в момент использования» про сервисы ЧУЖИХ
      // плагинов. Без реестра фокуса редактор не имеет права работать: набранное терялось бы
      // молча. Хранилище снимков — общее на все редакторы, и вид на него надевается именем
      // ВКЛАДА: снимки Monaco и структурного редактора живут под разными ключами.
      const focus = options.focus ?? ctx.services.require(TextEditorFocusToken);
      const viewStates =
        options.viewStates ??
        viewStatesOver(ctx.services.require(EditorViewStatesToken).forEditor(MONACO_EDITOR_ID));
      contributeMessages(ctx.i18n);

      // Вклад собирается ОДИН раз, и его тело уходит и в точку редакторов, и наружу
      // возможностью: «тот же редактор» для соседей — это та же ссылка, а не похожий
      // компонент (см. {@link TextEditorCapability}).
      const contribution = monacoEditorContribution({ host, focus, viewStates });
      ctx.subscriptions.push(
        ctx.extensions.contribute(EditorPoint, contribution, { id: MONACO_EDITOR_ID }),
        ctx.services.register(TextEditorCapability, { TextEditor: contribution.Body })
      );
    },
  });
}
