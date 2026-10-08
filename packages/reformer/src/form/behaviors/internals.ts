/**
 * Внутренние утилиты слоя поведения: работа с групповыми узлами `$` и guard циклов.
 *
 * Ничего не знает про ambient-сток — это чистые функции над сигналами и value-proxy модели.
 * Наружу (в сабпат `/behaviors`) не экспортируется.
 *
 * @group Behaviors
 * @module form/behaviors/internals
 */

import type { Signal } from '@preact/signals-core';
import { isModelContainerSignal } from '../../model/model-signals-proxy';
import { isModelArraySignal } from '../../model/model-signals-proxy';

/** Групповой узел дерева `$`: набор дочерних сигналов плюс служебный путь. */
export type GroupSignals = Record<string, unknown> & { __path?: string };

/**
 * Лист модели, а не контейнерный узел дерева `$`.
 *
 * Узлы-группы/массивы тоже структурно совместимы с `ReadonlySignal` (у них есть `peek`/`value`/
 * `subscribe` над агрегатом поддерева), поэтому одного duck-typing по `peek` мало: без отсечки по
 * `isModelContainerSignal` группа уходила бы в скалярные ветки операторов — `enableWhen` молча
 * терял бы `enableGroup`, `apply` получал бы значение вместо под-модели, а `copyFrom` — запись в
 * read-only агрегат вместо рекурсивного `writeGroup`.
 */
export const isLeafSignal = (v: unknown): v is Signal<unknown> =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as { peek?: unknown }).peek === 'function' &&
  !isModelContainerSignal(v);

/**
 * Ручка значения целиком: лист либо узел-массив дерева `$`.
 *
 * Массив копируется и читается ЗНАЧЕНИЕМ — заменой целиком, а не обходом по ключам: у его узла
 * собственный ключ один (`length`), и обход, годный для группы, отдавал бы вместо массива мусор.
 * Для `enableWhen` массив при этом остаётся НЕ листом ({@link isLeafSignal}): его нода ищется по
 * пути, а она бывает и полем, и массивом под-форм.
 */
export const isValueHandle = (v: unknown): v is Signal<unknown> =>
  isLeafSignal(v) || isModelArraySignal(v);

export const asArray = <X>(v: X | X[]): X[] => (Array.isArray(v) ? v : [v]);

export function readGroup(g: GroupSignals): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(g)) {
    const child = g[k];
    out[k] = isValueHandle(child) ? child.value : readGroup(child as GroupSignals);
  }
  return out;
}
export function writeGroup(g: GroupSignals, val: Record<string, unknown>): void {
  for (const k of Object.keys(g)) {
    const child = g[k];
    if (isValueHandle(child)) child.value = val?.[k];
    else writeGroup(child as GroupSignals, (val?.[k] as Record<string, unknown>) ?? {});
  }
}

/**
 * Guard от расходящихся циклов пересчёта. Расходящийся взаимный compute/computeFrom (без
 * стабилизации) preact обрывает невнятным «Cycle detected» — перехватываем и заменяем понятной
 * ошибкой с именем поля и подсказкой. Сходящиеся compute (упираются в peek-guard) и массовые
 * синхронные мутации цикла не порождают → не затрагиваются.
 */
export function makeCycleGuard(target: Signal<unknown>): (write: () => void) => void {
  return (write) => {
    try {
      write();
    } catch (err) {
      if (err instanceof Error && /cycle detected/i.test(err.message)) {
        const path = (target as { __path?: string }).__path ?? '?';
        throw new Error(
          `[@reformer/core/behaviors] compute("${path}"): расходящийся цикл пересчёта — взаимные ` +
            `compute/computeFrom без стабилизации. Проверьте зависимости или добавьте стабилизирующее ` +
            `условие (when) / разорвите цикл через peek.`
        );
      }
      throw err;
    }
  };
}
