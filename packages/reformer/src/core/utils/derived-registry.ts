/**
 * Реестр производных (computed) сигналов.
 *
 * Операторы `compute`/`computeFrom` помечают сигнал-цель производным. Пути bulk-загрузки
 * (`model.set`/`model.patch`, `GroupNode.patchValue`/`setValue`) пропускают помеченные поля —
 * чтобы значение из payload не затирало вычисляемое (compute владеет им). Прямое присваивание и
 * `reset` НЕ затрагиваются — их пишет либо явный код, либо сам compute.
 *
 * @group Utils
 * @module core/utils/derived-registry
 */

import type { Signal } from '@preact/signals-core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const derived = new WeakSet<Signal<any>>();

/**
 * Пометить сигнал производным (вычисляемым).
 *
 * Вызывается операторами {@link computeFrom}/`compute` для их сигнала-цели. После этого
 * bulk-сеттеры (`model.set`/`model.patch`, `patchValue`/`setValue`) пропускают это поле, чтобы
 * значение из payload не затирало вычисляемое. Прикладной код напрямую обычно не вызывает.
 *
 * @param signal - Сигнал значения из {@link FormModel}, которым владеет compute
 *
 * @example
 * ```typescript
 * import { markDerived } from '@reformer/core';
 *
 * // Помечаем поле total как вычисляемое — bulk-set его не перезапишет
 * markDerived(model.$.total);
 * ```
 *
 * @see {@link isDerived} - проверка пометки
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function markDerived(signal: Signal<any>): void {
  derived.add(signal);
}

/**
 * Производный ли сигнал (помечен через {@link markDerived}).
 *
 * Читается bulk-сеттерами модели/группы, чтобы не затирать вычисляемые (`computeFrom`) поля
 * значениями из payload.
 *
 * @param signal - Сигнал значения из {@link FormModel}
 * @returns `true`, если сигнал помечен производным
 *
 * @example
 * ```typescript
 * import { isDerived } from '@reformer/core';
 *
 * if (!isDerived(model.$.total)) {
 *   model.$.total.value = payload.total; // писать в payload-значение только для «ручных» полей
 * }
 * ```
 *
 * @see {@link markDerived} - пометить сигнал производным
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDerived(signal: Signal<any>): boolean {
  return derived.has(signal);
}
