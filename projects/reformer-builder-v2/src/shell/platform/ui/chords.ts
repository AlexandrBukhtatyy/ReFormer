/**
 * Состояние аккорда: первая ступень нажата, ждём вторую.
 *
 * ## Почему вне React
 *
 * Читателей двое, и они из разных миров: диспетчер клавиш (обычная функция, вызывается из
 * обработчика события) и строка состояния (компонент). Внешнее хранилище плюс
 * `useSyncExternalStore` обслуживает обоих одним значением; состояние внутри компонента —
 * только второго, и диспетчеру пришлось бы получать его окольным путём.
 *
 * ## Ожидание обязано заканчиваться
 *
 * Три выхода, и каждый закрывает свой способ застрять:
 *
 * - **вторая ступень** — обычный путь;
 * - **отмена** — голое Escape либо уход фокуса из окна: аккорд, переживший переключение
 *   на другое приложение, это ловушка, которая проглотит следующее нажатие;
 * - **таймаут** — на случай, когда человек передумал молча.
 *
 * Без таймаута состояние живёт до следующего нажатия, и «следующее» может случиться через
 * минуту — в чужом контексте, где человек уже забыл про начатый аккорд. У VS Code таймаута
 * нет, но там индикатор виден постоянно; у нас строка состояния одна и узкая.
 *
 * @module host/ui/chords
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';

/**
 * Сколько ждать вторую ступень.
 *
 * Пять секунд — время, за которое человек читает подсказку в строке состояния и решает.
 * Доли секунды превратили бы аккорд в гонку, а десятки секунд ничем не отличались бы
 * от отсутствия таймаута.
 */
export const CHORD_TIMEOUT_MS = 5000;

export interface ChordSnapshot {
  /** Уже нажатые ступени в каноническом написании. Пусто — ожидания нет. */
  readonly prefix: readonly string[];
  /** Подписи тех же ступеней для показа: `['Ctrl+K']`. */
  readonly labels: readonly string[];
}

export interface ChordState extends Disposable {
  /** Текущее состояние. Ссылка стабильна между изменениями — требование `useSyncExternalStore`. */
  get(): ChordSnapshot;
  /** Начинает ожидание. Повторный вызов заменяет ожидание и перезапускает таймер. */
  begin(prefix: readonly string[], labels: readonly string[]): void;
  /** Снимает ожидание. Молчит, если его и не было. */
  cancel(): void;
  subscribe(listener: () => void): Disposable;
}

export interface ChordStateOptions {
  readonly timeoutMs?: number;
  /**
   * Чем откладывать отмену. Параметром, а не `setTimeout` напрямую, по той же причине,
   * что у отложенных запросов палитры: окружение тестов — `node`, и проверять таймаут
   * настоящим таймером значило бы платить пятью секундами за прогон, который обязан
   * оставаться семисекундным целиком.
   */
  readonly schedule?: (fn: () => void, ms: number) => unknown;
  readonly cancelScheduled?: (handle: unknown) => void;
}

/** Пустое ожидание: одна замороженная ссылка вместо нового объекта на каждую отмену. */
const IDLE: ChordSnapshot = Object.freeze({
  prefix: Object.freeze([]),
  labels: Object.freeze([]),
});

export function createChordState(options: ChordStateOptions = {}): ChordState {
  const timeoutMs = options.timeoutMs ?? CHORD_TIMEOUT_MS;
  const schedule =
    options.schedule ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const cancelScheduled =
    options.cancelScheduled ??
    ((handle: unknown): void => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });

  let snapshot: ChordSnapshot = IDLE;
  let timer: unknown = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    const errors: unknown[] = [];
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'ошибки в подписчиках аккорда');
  }

  function clearTimer(): void {
    if (timer === null) return;
    cancelScheduled(timer);
    timer = null;
  }

  function reset(): void {
    clearTimer();
    if (snapshot === IDLE) return;
    snapshot = IDLE;
    notify();
  }

  return {
    get: (): ChordSnapshot => snapshot,

    begin(prefix: readonly string[], labels: readonly string[]): void {
      clearTimer();
      snapshot = Object.freeze({
        prefix: Object.freeze([...prefix]),
        labels: Object.freeze([...labels]),
      });
      timer = schedule(() => {
        timer = null;
        reset();
      }, timeoutMs);
      notify();
    },

    cancel(): void {
      reset();
    },

    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    dispose(): void {
      clearTimer();
      listeners.clear();
      snapshot = IDLE;
    },
  };
}
