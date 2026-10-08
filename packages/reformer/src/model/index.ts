/**
 * `@reformer/core/model` — низкоуровневый реактивный субстрат и barrel модуля `model`.
 *
 * Это «прокси-объект с сигналами» и инструментарий для построения доменных модулей поверх него
 * (form, table, …). Модуль СТРОГО реактивный: НИЧЕГО связанного с формами/валидацией/схемами здесь
 * нет — только модель, value-операции, producer-флаг и утилиты субстрата. Граница model⇏form
 * зафиксирована ESLint-правилом (`no-restricted-imports` на `src/model/**`).
 *
 * Реактивный рантайм (`signal/computed/effect/…`) живёт в отдельном subpath `@reformer/core/signals`
 * (единый владелец `@preact/signals-core`) — импортируй его оттуда; здесь он НЕ реэкспортируется,
 * чтобы зонтичный barrel `.` не разрастался рантаймом.
 *
 * Состав (реэкспорты — из тех же файлов, что использует зонтик `.`, поэтому `.` и `/model` — один
 * module-инстанс: общий `derived`-WeakMap, единая идентичность `Signal`):
 * - **модель** — `createModel` + типы `FormModel`/`ModelArray`/… + `PathAwareSignal`;
 * - **шаблон элемента массива** — `arrayOf(blank)`: что кладёт `push()` без значения;
 * - **обход значений** — `eachLeafSignal` (листья) и `eachValueSignal` (листья и массивы целиком);
 * - **ручка → фасад** — `modelOf(model.$.<группа | массив>)`: под-модель или фасад массива;
 * - **value-операции** (реактивные правила) — `computeFrom`/`copyFrom`/`watchField`/`transformValue`/
 *   `resetWhen`/`syncFields`/`revalidateWhen`;
 * - **producer-owned флаг** — `markDerived`/`isDerived`/`unmarkDerived`;
 * - **утилиты субстрата** — `runOutsideEffect`/`safeCallback`/`safeDebouncedCallback`.
 *
 * @group Model
 * @module model
 */

// Реактивная модель данных.
export { createModel, eachLeafSignal, eachValueSignal } from './create-model';
// Массив модели с шаблоном нового элемента — `push()` / «Добавить» без значения.
export { arrayOf } from './model-nodes';
export type {
  FormModel,
  ModelArray,
  ModelArraySignals,
  ModelGroupSignals,
  ModelObject,
  ModelValue,
  ModelSignals,
  ModelApi,
  PathAwareSignal,
} from './types';
export { isModelContainerSignal, isValueSignal } from './model-signals-proxy';
// Ручка `$` → value-фасад (под-модель группы или фасад массива), по идентичности.
export { modelOf } from './model-value-proxy';
export type { ModelOf } from './model-value-proxy';

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
