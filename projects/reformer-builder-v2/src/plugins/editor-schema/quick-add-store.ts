/**
 * Открыт ли диалог быстрого добавления.
 *
 * ## Почему состояние живёт вне тела редактора
 *
 * Диалог открывает КОМАНДА — с клавиши, из палитры команд, когда-нибудь от ассистента.
 * Команда живёт у плагина и про смонтированные компоненты ничего не знает; тело редактора,
 * наоборот, пересоздаётся на пару «редактор + документ». Состояние, положенное внутрь тела,
 * было бы недоступно команде, а положенное в модуль — общим на все документы сразу.
 *
 * Поэтому здесь маленький стор с подпиской: команда пишет, тело читает. Ровно тот же приём,
 * что у режима документа ({@link './view-mode'}) и предпочтений канваса, и по той же причине.
 *
 * Диалог один на редактор, а не на документ: он модальный, и двух открытых сразу не бывает.
 *
 * @module plugins/editor-schema/quick-add-store
 */

import type { Disposable } from '@/sdk';

export interface QuickAddStore extends Disposable {
  isOpen(): boolean;
  open(): void;
  close(): void;
  subscribe(listener: () => void): Disposable;
}

export function createQuickAddStore(): QuickAddStore {
  const listeners = new Set<() => void>();
  let opened = false;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Упавший подписчик — чужая поломка: остальные всё равно обязаны узнать о смене.
        console.error('[editor-schema] подписчик быстрого добавления отказал', error);
      }
    }
  };

  const set = (next: boolean): void => {
    if (opened === next) return;
    opened = next;
    notify();
  };

  return {
    isOpen: () => opened,
    open: () => {
      set(true);
    },
    close: () => {
      set(false);
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
      opened = false;
    },
  };
}
