/**
 * Чем показан документ схемы: конструктором или исходным JSON.
 *
 * ## Это режим ОДНОГО редактора, а не выбор из двух
 *
 * Разница видна по тому, что происходит с состоянием. Смени редактор — и сеанс правки
 * начнётся заново: выделение, история, раскрытые узлы дерева принадлежат конкретному телу.
 * Смени режим — и всё это останется на месте, потому что документ и сеанс те же, а меняется
 * только то, чем он нарисован. Человеку нужно второе: «покажи мне тот же файл текстом»,
 * а не «открой его другим редактором и потеряй, где я был».
 *
 * Отсюда и место состояния: не в теле редактора, а в плагине — тело может быть не смонтировано
 * (вкладка неактивна), а кнопка в полосе вкладок и палитра команд обязаны работать всё равно.
 * То же решение, что у режимов markdown, и по той же причине.
 *
 * ## Предпочтение липкое
 *
 * Человек смотрит схемы одним способом: открыл одну исходником — и следующую хочет так же.
 * Область настройки `user`: способ показа принадлежит человеку, а не проекту.
 *
 * @module plugins/editor-schema/view-mode
 */

import type { Disposable, ResourceId } from '@/sdk';

/** Чем нарисован документ схемы. */
export type SchemaView = 'design' | 'code';

/** Ключ настройки предпочтения. */
export const SCHEMA_VIEW_SETTING = 'editor-schema.view';

/**
 * Режим по умолчанию — конструктор.
 *
 * В отличие от markdown, где умолчание — исходник: схему открывают, чтобы собрать форму,
 * а не чтобы прочитать JSON. Текст здесь — способ разобраться, когда конструктор чего-то
 * не показывает, и потому он второй, а не первый.
 */
export const DEFAULT_SCHEMA_VIEW: SchemaView = 'design';

/** Режим ли это. Непрозрачное значение из настроек приходит от прошлых версий приложения. */
export function isSchemaView(value: unknown): value is SchemaView {
  return value === 'design' || value === 'code';
}

/** Значение настройки → режим. Мусор трактуется как умолчание, а не как повод падать. */
export function readSchemaView(value: unknown): SchemaView {
  return isSchemaView(value) ? value : DEFAULT_SCHEMA_VIEW;
}

/** Настройки в объёме, нужном режиму. */
export interface SchemaViewSettings {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): Promise<void> | void;
}

export interface SchemaViewStore extends Disposable {
  /** Режим документа; первый вопрос отвечает предпочтением из настроек. */
  get(id: ResourceId): SchemaView;
  /** Задаёт режим. `remember` по умолчанию истинно: смена режима человеком и есть выбор. */
  set(id: ResourceId, view: SchemaView, remember?: boolean): void;
  /** Забывает документ: вкладку закрыли. */
  forget(id: ResourceId): void;
  subscribe(listener: () => void): Disposable;
}

export interface SchemaViewStoreOptions {
  readonly settings?: SchemaViewSettings | null;
  /**
   * Есть ли чем показать исходник. Без редактора кода режима `code` не существует:
   * кнопка, ведущая в пустоту, обещает то, чего не будет.
   */
  readonly hasTextEditor: () => boolean;
}

export function createSchemaViewStore(options: SchemaViewStoreOptions): SchemaViewStore {
  const views = new Map<ResourceId, SchemaView>();
  const listeners = new Set<() => void>();

  const clamp = (view: SchemaView): SchemaView =>
    view === 'code' && !options.hasTextEditor() ? 'design' : view;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Упавший подписчик — чужая поломка: она не должна мешать остальным узнать о смене.
        console.error('[editor-schema] подписчик режима отказал', error);
      }
    }
  };

  return {
    get(id) {
      const current = views.get(id);
      if (current !== undefined) return clamp(current);
      return clamp(readSchemaView(options.settings?.get(SCHEMA_VIEW_SETTING)));
    },

    set(id, view, remember = true) {
      const next = clamp(view);
      if (views.get(id) === next) return;
      views.set(id, next);
      if (remember) {
        void Promise.resolve(options.settings?.set(SCHEMA_VIEW_SETTING, next)).catch(
          (error: unknown) => {
            // Отказ хранилища не должен мешать переключению: предпочтение просто не переживёт
            // перезагрузку, и это меньшая беда, чем неработающая кнопка.
            console.error('[editor-schema] предпочтение вида не сохранено', error);
          }
        );
      }
      notify();
    },

    forget(id) {
      if (views.delete(id)) notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        },
      };
    },

    dispose() {
      views.clear();
      listeners.clear();
    },
  };
}
