/**
 * Ожидание проверки поля: раннер валидации отмечает начало и конец async-правил парой вызовов.
 * Вызовы считаются — поле ждёт, пока идёт хотя бы один прогон; устаревший прогон снимает только
 * свою отметку.
 *
 * Счётчик — обычное число: реактивен только признак «ждёт», и он меняется, лишь когда счётчик
 * переходит через ноль.
 *
 * @internal
 * @module form/nodes/state/pending
 */

import type { ReadonlySignal } from '@preact/signals-core';
import { OwnedSignal } from './owned-signal';

export interface PendingState {
  readonly active: ReadonlySignal<boolean>;
  mark(pending: boolean): void;
}

class Pending implements PendingState {
  private runs = 0;
  private readonly activeSignal = new OwnedSignal(false);

  get active(): ReadonlySignal<boolean> {
    return this.activeSignal;
  }

  mark(pending: boolean): void {
    this.runs = Math.max(0, this.runs + (pending ? 1 : -1));
    this.activeSignal.set(this.runs > 0);
  }
}

export function createPending(): PendingState {
  return new Pending();
}
