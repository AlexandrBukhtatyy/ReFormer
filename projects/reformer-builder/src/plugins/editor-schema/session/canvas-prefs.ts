/**
 * Предпочтения канваса: каким видом показан конструктор.
 *
 * ## Почему это не третий режим документа
 *
 * {@link SchemaViewStore} отвечает на вопрос «чем нарисован документ» — конструктором или
 * исходником, и у него есть пара кнопок в полосе вкладок. Здесь вопрос другой: каким видом
 * работает САМ конструктор. Сделай их одним перечислением — и «переключить конструктор
 * и исходник» стало бы циклом из трёх состояний, где кнопка не может сказать, что будет
 * после нажатия. Поэтому измерения два, а переключатель вида конструктора стоит
 * в полосе вкладок рядом с переключателем режима (`./canvas-actions`): вопрос у них общий —
 * чем показан этот документ, — и разносить ответы по двум местам экрана значило бы их
 * рассогласовать.
 *
 * ## Предпочтение общее, а не по документу
 *
 * Человек работает одним способом: привык к схеме — хочет схему и в следующем файле.
 * По той же причине оно липкое и лежит в настройках области `user` — способ смотреть
 * принадлежит человеку, а не проекту. Ровно то же решение, что у режима документа.
 *
 * @module plugins/editor-schema/session/canvas-prefs
 */

import type { Disposable } from '@/sdk';
import type { SchemaViewSettings } from './view-mode';

/**
 * Каким видом показан конструктор.
 *
 * `live` — настоящая форма из компонентов кита, нарисованная поверхностью превью. Она такой же
 * вид конструктора, как дерево и схема: занимает тело вкладки целиком, выделяет узлы и принимает
 * бросок. Отличие одно — рисует её чужой плагин, поэтому вид существует, только если композиция
 * дала порт (см. `SchemaEditorHost.live`).
 */
export type CanvasView = 'tree' | 'schematic' | 'live';

/** Ключ настройки. Область — `user`: способ смотреть принадлежит человеку. */
export const CANVAS_VIEW_SETTING = 'editor-schema.canvasView';

/**
 * Вид по умолчанию — дерево.
 *
 * Оно читается на любой схеме, включая ту, что собрана не мышью: сотня полей в дереве
 * остаётся списком, а в схеме превращается в полотно, по которому надо ездить. Схему
 * выбирают, когда работают с раскладкой, и этот выбор запоминается.
 *
 * Живая форма умолчанием быть не может по другой причине: её вид зависит от того, дала ли
 * композиция порт и взялась ли поверхность за документ. Умолчание, которого на половине
 * запусков нет, — это не умолчание.
 */
export const DEFAULT_CANVAS_VIEW: CanvasView = 'tree';

/** Вид ли это. Значение из настроек приходит от прошлых версий приложения. */
export function isCanvasView(value: unknown): value is CanvasView {
  return value === 'tree' || value === 'schematic' || value === 'live';
}

/** Значение настройки → вид. Мусор трактуется как умолчание, а не как повод падать. */
export function readCanvasView(value: unknown): CanvasView {
  return isCanvasView(value) ? value : DEFAULT_CANVAS_VIEW;
}

export interface CanvasPrefs extends Disposable {
  view(): CanvasView;
  setView(view: CanvasView): void;
  subscribe(listener: () => void): Disposable;
}

export interface CanvasPrefsOptions {
  /** Настройки; `null` — предпочтение живёт только до перезагрузки. */
  readonly settings?: SchemaViewSettings | null;
}

export function createCanvasPrefs(options: CanvasPrefsOptions = {}): CanvasPrefs {
  const settings = options.settings ?? null;
  const listeners = new Set<() => void>();
  // Своя копия рядом с настройками: переключатель обязан отвечать в том же кадре, а запись
  // в хранилище асинхронна. Тот же приём, что у режима документа.
  let view: CanvasView | null = null;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Упавший подписчик — чужая поломка: она не должна мешать остальным узнать о смене.
        console.error('[editor-schema] подписчик предпочтений канваса отказал', error);
      }
    }
  };

  const remember = (key: string, value: unknown): void => {
    void Promise.resolve(settings?.set(key, value)).catch((error: unknown) => {
      // Отказ хранилища не мешает переключению: предпочтение просто не переживёт перезагрузку,
      // и это меньшая беда, чем неработающая кнопка.
      console.error('[editor-schema] предпочтение канваса не сохранено', error);
    });
  };

  return {
    view() {
      if (view !== null) return view;
      return readCanvasView(settings?.get(CANVAS_VIEW_SETTING));
    },

    setView(next) {
      if (this.view() === next) return;
      view = next;
      remember(CANVAS_VIEW_SETTING, next);
      notify();
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
      listeners.clear();
      view = null;
    },
  };
}
