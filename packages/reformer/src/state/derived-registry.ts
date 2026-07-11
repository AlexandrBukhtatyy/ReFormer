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

/**
 * Реестр производных сигналов с подсчётом ссылок.
 *
 * Значение — число активных `compute`/`computeFrom`, владеющих этим сигналом. Refcount нужен потому,
 * что один и тот же сигнал-цель могут пометить несколько операторов (или один оператор
 * перерегистрироваться): {@link unmarkDerived} снимает пометку только когда снят ПОСЛЕДНИЙ владелец,
 * иначе поле, за которым ещё стоит живой compute, ошибочно разморозилось бы для bulk-set.
 *
 * `WeakMap` — чтобы запись автоматически освобождалась при сборке самого сигнала GC (нет утечки, даже
 * если очистка не была вызвана).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const derived = new WeakMap<Signal<any>, number>();

/**
 * Пометить сигнал производным (вычисляемым).
 *
 * Вызывается операторами {@link computeFrom}/`compute` для их сигнала-цели. После этого
 * bulk-сеттеры (`model.set`/`model.patch`, `patchValue`/`setValue`) пропускают это поле, чтобы
 * значение из payload не затирало вычисляемое. Прикладной код напрямую обычно не вызывает.
 *
 * Идемпотентна на уровне флага: повторные вызовы наращивают счётчик ссылок, чтобы каждый оператор,
 * пишущий в этот сигнал, был сбалансирован своим {@link unmarkDerived} при dispose.
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
 * @see {@link unmarkDerived} - снять пометку при dispose оператора
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function markDerived(signal: Signal<any>): void {
  derived.set(signal, (derived.get(signal) ?? 0) + 1);
}

/**
 * Снять пометку производного сигнала (обратная операция к {@link markDerived}).
 *
 * Вызывается из очистки (`onDispose`) оператора `compute`/`computeFrom`, когда поведение снимается,
 * но модель/сигнал продолжают жить (динамическая перекоммутация: удалить под-схему → сохранить модель
 * → bulk-set). Без этого сигнал остаётся помеченным навсегда, и bulk-сеттеры навсегда пропускают
 * поле, которое больше ничем не вычисляется.
 *
 * Учитывает счётчик ссылок: пометка снимается только когда снят последний владелец. Вызов на
 * непомеченном сигнале — безопасный no-op.
 *
 * @param signal - Сигнал значения из {@link FormModel}, ранее помеченный {@link markDerived}
 *
 * @example
 * ```typescript
 * import { markDerived, unmarkDerived } from '@reformer/core';
 *
 * markDerived(model.$.total);
 * onDispose(() => unmarkDerived(model.$.total)); // при снятии compute снова разрешаем bulk-set
 * ```
 *
 * @see {@link markDerived} - пометить сигнал производным
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unmarkDerived(signal: Signal<any>): void {
  const count = derived.get(signal);
  if (count === undefined) return;
  if (count <= 1) derived.delete(signal);
  else derived.set(signal, count - 1);
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
