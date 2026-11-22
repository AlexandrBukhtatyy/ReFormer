/**
 * Состояние ячейки «кит» как наблюдаемое значение: список китов, который сам узнаёт, что устарел.
 *
 * Список — функция от службы китов ({@link describeKits}), а меняется он по двум поводам: сменился
 * активный кит и изменился набор китов (плагин внёс свой или его выключили). Оба события служба
 * рассылает сама; ячейка их только слушает.
 *
 * **Почему ячейка живёт в плагине китов.** Выбор кита — действие над службой китов, и знать его
 * больше некому: встроенный выбор профиля о китах не знает (состав приложения без форм обходится
 * без них вовсе), а третий плагин ради одной ячейки был бы плагином-прослойкой.
 *
 * ## Снимок стабилен между изменениями
 *
 * {@link KitCellStore.get} отдаёт ОДНУ И ТУ ЖЕ ссылку, пока ничего не изменилось, — условие
 * `useSyncExternalStore`. Пересчёт на каждый вызов дал бы новую ссылку на каждой отрисовке и
 * бесконечную перерисовку ячейки.
 *
 * @module plugins/forms/kits/cell
 */

import type { Disposable, KitsService, KitSummary } from '@reformer/builder-plugin-api';

/** Идентификатор ячейки строки состояния. Он же — адрес вклада в точке панелей. */
export const KITS_CELL_ID = 'kits.cell';

export interface KitCellState {
  /** Между чем можно выбирать — в порядке службы: встроенные первыми, затем внесённые. */
  readonly kits: readonly KitSummary[];
  /** Название действующего кита либо `null`, когда показывать нечего. */
  readonly label: string | null;
  readonly activeId: string | null;
}

/** Что ячейка читает у службы. */
export type KitCellSource = Pick<KitsService, 'available' | 'onDidChange' | 'onDidChangeAvailable'>;

export interface KitCellStore extends Disposable {
  /** Текущий список; ссылка стабильна до следующего изменения. */
  get(): KitCellState;
  subscribe(listener: () => void): Disposable;
}

/** Снимок: список китов и название действующего. */
export function describeKits(kits: Pick<KitsService, 'available'>): KitCellState {
  const available = kits.available();
  const active = available.find((kit) => kit.active);
  return { kits: available, label: active?.label ?? null, activeId: active?.id ?? null };
}

export function createKitCellStore(kits: KitCellSource): KitCellStore {
  const listeners = new Set<() => void>();
  let snapshot: KitCellState | null = null;

  const invalidate = (): void => {
    snapshot = null;
    // Копия: подписчик вправе отписаться прямо в обработчике.
    for (const listener of [...listeners]) listener();
  };

  const subscriptions = [kits.onDidChange(invalidate), kits.onDidChangeAvailable(invalidate)];

  return {
    get() {
      snapshot ??= describeKits(kits);
      return snapshot;
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
      for (const subscription of subscriptions) subscription.dispose();
      listeners.clear();
    },
  };
}
