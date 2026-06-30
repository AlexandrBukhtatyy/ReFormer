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

/** Пометить сигнал производным (вызывают compute/computeFrom). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function markDerived(signal: Signal<any>): void {
  derived.add(signal);
}

/** Производный ли сигнал (читают bulk-сеттеры, чтобы не затирать вычисляемые поля). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDerived(signal: Signal<any>): boolean {
  return derived.has(signal);
}
