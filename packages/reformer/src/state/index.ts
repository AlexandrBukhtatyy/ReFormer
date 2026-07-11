/**
 * `@reformer/core/state` — низкоуровневый реактивный **state-субстрат** (M1) и barrel модуля `state`.
 *
 * Это «прокси-объект с сигналами» и инструментарий для построения доменных модулей поверх него
 * (form, table, …). Модуль СТРОГО реактивный: НИЧЕГО связанного с формами/валидацией/схемами здесь
 * нет — только модель, value-операции, producer-флаг и утилиты субстрата. Граница state⇏form
 * зафиксирована ESLint-правилом (`no-restricted-imports` на `src/state/**`).
 *
 * Реактивный рантайм (`signal/computed/effect/…`) живёт в отдельном subpath `@reformer/core/signals`
 * (единый владелец `@preact/signals-core`) — импортируй его оттуда; здесь он НЕ реэкспортируется,
 * чтобы зонтичный barrel `.` не разрастался рантаймом.
 *
 * Состав (реэкспорты — из тех же файлов, что использует зонтик `.`, поэтому `.` и `/state` — один
 * module-инстанс: общий `derived`-WeakMap, единая идентичность `Signal`):
 * - **модель** — `createModel` + типы `FormModel`/`ModelArray`/… + `PathAwareSignal`;
 * - **value-операции** (реактивные правила) — `computeFrom`/`copyFrom`/`watchField`/`transformValue`/
 *   `resetWhen`/`syncFields`/`revalidateWhen`;
 * - **producer-owned флаг** — `markDerived`/`isDerived`/`unmarkDerived`;
 * - **утилиты субстрата** — `runOutsideEffect`/`safeCallback`/`safeDebouncedCallback`,
 *   `SubscriptionManager`.
 *
 * @group State
 * @module state
 */

// Реактивная модель данных.
export { createModel } from './form-model';
export type {
  FormModel,
  ModelArray,
  ModelObject,
  ModelValue,
  ModelSignals,
  ModelApi,
  PathAwareSignal,
} from './types';

// Value-операции behavior (читают/пишут сигналы, нод/валидации не касаются).
export {
  computeFrom,
  copyFrom,
  watchField,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
} from './behaviors-value';
export type { BehaviorCleanup } from './behaviors-value';

// Producer-owned флаг: bulk-set/patch не затирает вычисляемые (compute) поля.
export { markDerived, isDerived, unmarkDerived } from './derived-registry';

// Утилиты субстрата (реактивные правила / lifecycle).
export { runOutsideEffect, safeCallback, safeDebouncedCallback } from './safe-effect';
export { SubscriptionManager } from './subscription-manager';
