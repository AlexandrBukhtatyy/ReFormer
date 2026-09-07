/**
 * Мост между сеансом редактора схемы и поверхностью, которая рисует форму.
 *
 * ## Схема идёт из МОДЕЛИ, а не из буфера
 *
 * Поверхность превью, смонтированная панелью, читает схему из текста документа. Здесь так
 * нельзя: редактор правит модель, а буфер по ней перерисовывается ОТЛОЖЕННО — пока в текстовом
 * редакторе печатает человек, платформа запись придерживает. Возьми живой вид схему из буфера,
 * форма отставала бы от канваса ровно на эту задержку, а в расхождении показывала бы вчерашнее.
 *
 * ## Ссылка на схему обязана быть стабильной
 *
 * Поверхность читает `schema()` через `useSyncExternalStore` и сравнивает результат ПО ССЫЛКЕ.
 * Новый объект на каждый вызов означает пересборку формы на каждом кадре — с потерей фокуса
 * и введённых значений. Снимок сеанса заморожен и стабилен, поэтому здесь достаточно отдавать
 * его модель как есть; собственного кэша не нужно.
 *
 * ## Обычный клик по форме выделение НЕ меняет
 *
 * Поверхность зовёт `select()` на любой клик — так устроен её хит-тест. Но в живом виде форма
 * настоящая: клик по чекбоксу переключает чекбокс, а не выбирает узел. Выбор — это Alt+клик,
 * и ловит его сам живой вид, поэтому `select` поверхности проходит только когда встраивающий
 * этого ждёт ({@link LiveContextDeps.accepts}). Иначе один клик ставил бы выделение дважды —
 * и вторым, поздним, затирал бы разбор модификаторов.
 *
 * @module plugins/editor-schema/live/live-context
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { Disposable, NodeId } from '@/sdk';
import type { LiveSurfaceContext } from '../host';
import type { SchemaEditorState } from '../session/sessions';

/** Контекст вместе с тем, чем его двигают. */
export interface LiveContextHandle extends LiveSurfaceContext {
  /**
   * Сообщить, что состояние сеанса изменилось.
   *
   * Зовёт тело живого вида: собственной подписки у сеанса нет — версию рассылает реестр,
   * а снимок компонент получает пропом. Разделение на два уведомления не косметика: правка
   * модели пересобирает форму, смена выделения — только подсветку.
   */
  push(state: SchemaEditorState): void;
  dispose(): void;
}

export interface LiveContextDeps {
  /** Состояние на момент создания: поверхность может прочитать схему до первого `push`. */
  readonly initial: SchemaEditorState;
  /** Ждёт ли встраивающий выбора от поверхности. См. шапку модуля. */
  readonly accepts: () => boolean;
  /** Куда уходит выбор, когда его принимают. */
  readonly onSelect: (ids: readonly NodeId[]) => void;
  /** Находки сборки — уже сведёнными строками. */
  readonly onProblems?: (messages: readonly string[]) => void;
}

export function createLiveContext(deps: LiveContextDeps): LiveContextHandle {
  let state = deps.initial;
  const schemaListeners = new Set<() => void>();
  const selectionListeners = new Set<() => void>();

  const fire = (listeners: ReadonlySet<() => void>): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Политика всех хранилищ проекта: упавший подписчик не мешает остальным узнать.
        console.error('[editor-schema] подписчик живого вида отказал', error);
      }
    }
  };

  const subscribe = (listeners: Set<() => void>, cb: () => void): Disposable => {
    listeners.add(cb);
    return {
      dispose(): void {
        listeners.delete(cb);
      },
    };
  };

  return {
    schema: (): JsonFormSchema | null => state.model,
    onDidChangeSchema: (cb) => subscribe(schemaListeners, cb),

    selection: () => state.selection,
    onDidChangeSelection: (cb) => subscribe(selectionListeners, cb),

    select(ids: readonly NodeId[]): void {
      if (!deps.accepts()) return;
      deps.onSelect(ids);
    },

    report(messages: readonly string[]): void {
      deps.onProblems?.(messages);
    },

    push(next: SchemaEditorState): void {
      const previous = state;
      if (previous === next) return;
      state = next;
      // Сравнение по ссылке, а не по содержимому: снимок сеанса заморожен и переиспользуется,
      // а правка модели даёт новый объект благодаря structural sharing.
      if (previous.model !== next.model) fire(schemaListeners);
      if (previous.selection !== next.selection) fire(selectionListeners);
    },

    dispose(): void {
      schemaListeners.clear();
      selectionListeners.clear();
    },
  };
}
