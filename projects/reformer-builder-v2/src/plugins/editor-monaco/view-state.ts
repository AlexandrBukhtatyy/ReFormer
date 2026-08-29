/**
 * Состояние вида: прокрутка и позиция каретки. И ничего больше.
 *
 * Выделение сюда **не входит** — так требует контракт (`host/ui/editors.ts` и
 * `docs/editors-and-preview.md`): выделение участвует в операциях правки, переезжает
 * на `focus` после вставки и входит в снимок отмены. Редактор, положивший его сюда,
 * получил бы вторую копию выделения, расходящуюся с первой.
 *
 * ## Почему снимок записывается заранее, а не снимается по требованию
 *
 * `viewState.capture(id)` оболочка зовёт в уборке эффекта раскладки — то есть в тот момент,
 * когда тело редактора уже могло быть размонтировано, а экземпляр Monaco — освобождён.
 * Спрашивать состояние у мёртвого редактора нечем. Поэтому редактор пишет снимок в реестр
 * по ходу дела (прокрутка, перемещение каретки), а `capture` только достаёт последний
 * записанный. Симметрично `restore` кладёт снимок обратно, а применяет его следующий
 * экземпляр при монтировании: тело пересоздаётся на пару «редактор + документ»
 * (`key` в `EditorArea`), и другого момента у него нет.
 *
 * ## Почему значение проверяется на чтении
 *
 * Хранилище состояния вида держит непрозрачные значения и никогда в них не заглядывает —
 * туда может прийти что угодно, включая снимок прошлой версии редактора. Поэтому
 * {@link readViewState} — не приведение типа, а проверка: непонятное значение равносильно
 * отсутствию снимка, и редактор просто открывается сверху.
 *
 * @module plugins/editor-monaco/view-state
 */

import type { ResourceId } from '@/sdk';

/** Прокрутка в пикселях, позиция каретки в координатах Monaco (строка и колонка с единицы). */
export interface MonacoViewState {
  readonly scrollTop: number;
  readonly scrollLeft: number;
  readonly line: number;
  readonly column: number;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Проверяет непрозрачное значение из хранилища.
 *
 * `null` вместо исключения: невнятный снимок — обычное дело (другая версия редактора,
 * ручная правка хранилища), и падать из-за него означало бы не открыть файл вовсе.
 * Отрицательная прокрутка и нулевая строка отвергаются наравне с чужим типом: Monaco
 * такие координаты молча зажимает, и снимок стал бы «почти тем же», а это хуже отказа.
 */
export function readViewState(value: unknown): MonacoViewState | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<Record<keyof MonacoViewState, unknown>>;
  if (!isFinitePositive(raw.scrollTop) || !isFinitePositive(raw.scrollLeft)) return null;
  if (!isFinitePositive(raw.line) || !isFinitePositive(raw.column)) return null;
  if (raw.line < 1 || raw.column < 1) return null;
  return {
    scrollTop: raw.scrollTop,
    scrollLeft: raw.scrollLeft,
    line: raw.line,
    column: raw.column,
  };
}

/** Совпадают ли снимки. Нужно, чтобы не переписывать реестр на каждом кадре прокрутки. */
export function isSameViewState(a: MonacoViewState, b: MonacoViewState): boolean {
  return (
    a.scrollTop === b.scrollTop &&
    a.scrollLeft === b.scrollLeft &&
    a.line === b.line &&
    a.column === b.column
  );
}

/**
 * Реестр снимков по документам.
 *
 * Ключ — документ, а не пара «редактор + документ»: пару различает уже хранилище оболочки,
 * а этот реестр принадлежит одному редактору и второго различия не несёт.
 */
export interface ViewStateRegistry {
  record(id: ResourceId, state: MonacoViewState): void;
  /** Последний записанный снимок или `null`. */
  peek(id: ResourceId): MonacoViewState | null;
  forget(id: ResourceId): void;
}

export function createViewStateRegistry(): ViewStateRegistry {
  const states = new Map<ResourceId, MonacoViewState>();
  return {
    record(id, state) {
      const previous = states.get(id);
      if (previous !== undefined && isSameViewState(previous, state)) return;
      states.set(id, state);
    },
    peek: (id) => states.get(id) ?? null,
    forget(id) {
      states.delete(id);
    },
  };
}
