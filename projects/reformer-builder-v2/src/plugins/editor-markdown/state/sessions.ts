/**
 * Режим показа по документам: что открыто исходником, что предпросмотром, что рядом.
 *
 * ## Почему состояние живёт в плагине, а не в теле редактора
 *
 * Режим переключают КНОПКИ в строке вкладок, а они — пункты меню, то есть команды. Команда
 * не имеет доступа к React-состоянию тела редактора и не должна его иметь: тело может быть
 * не смонтировано вовсе (вкладка неактивна), а «переключить вид» из палитры обязано работать.
 * Поэтому режим держит плагин, а тело редактора его читает — тем же приёмом, что состояния
 * генерации в плагине кодогена.
 *
 * ## Значение по умолчанию берётся из настроек и туда же возвращается
 *
 * Человек читает документацию одним способом: открыл README предпросмотром — и следующий
 * файл хочет видеть так же. Поэтому явная смена режима записывает предпочтение, а новый
 * документ его читает. Это «липкость» из v1, только через службу настроек, а не мимо неё.
 *
 * @module plugins/editor-markdown/state/sessions
 */

import type { Disposable, ResourceId } from '@/sdk';
import { clampView, readView, type MarkdownView } from './view';

/** Настройки в объёме, нужном режиму. `Pick` от службы: форма обязана совпадать буква в букву. */
export interface ViewSettings {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): Promise<void> | void;
}

export interface MarkdownViewStore extends Disposable {
  /** Режим документа. Первый вопрос про документ отвечает предпочтением из настроек. */
  get(id: ResourceId): MarkdownView;
  /**
   * Задаёт режим документа.
   *
   * `remember` по умолчанию истинно: смена режима человеком и есть его предпочтение.
   * Ложным он бывает у приведения к доступному («рядом» без редактора кода) — такое
   * приведение не является выбором и запоминаться не должно.
   */
  set(id: ResourceId, view: MarkdownView, remember?: boolean): void;
  /** Забывает документ: вкладку закрыли. */
  forget(id: ResourceId): void;
  subscribe(listener: () => void): Disposable;
}

export interface MarkdownViewStoreOptions {
  readonly settings?: ViewSettings | null;
  /** Ключ настройки предпочтения. */
  readonly settingKey: string;
  /** Доступен ли режим «рядом»: он требует редактора кода от композиции. */
  readonly hasTextEditor: () => boolean;
}

export function createMarkdownViewStore(options: MarkdownViewStoreOptions): MarkdownViewStore {
  const views = new Map<ResourceId, MarkdownView>();
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Упавший подписчик — чужая поломка: она не должна мешать остальным узнать о смене.
        console.error('[markdown] подписчик режима отказал', error);
      }
    }
  };

  const preferred = (): MarkdownView =>
    clampView(readView(options.settings?.get(options.settingKey)), options.hasTextEditor());

  return {
    get(id) {
      const current = views.get(id);
      if (current === undefined) return preferred();
      return clampView(current, options.hasTextEditor());
    },

    set(id, view, remember = true) {
      const next = clampView(view, options.hasTextEditor());
      if (views.get(id) === next) return;
      views.set(id, next);
      if (remember) {
        // Отказ хранилища настроек не должен мешать переключению: предпочтение просто
        // не переживёт перезагрузку, и это меньшая беда, чем неработающая кнопка.
        void Promise.resolve(options.settings?.set(options.settingKey, next)).catch(
          (error: unknown) => {
            console.error('[markdown] предпочтение вида не сохранено', error);
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
