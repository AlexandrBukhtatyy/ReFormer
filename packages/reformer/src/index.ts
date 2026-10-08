/**
 * Публичный barrel `@reformer/core` — зонтик над слоями `model`, `form` и `platforms/react`.
 *
 * `model` — реактивная модель данных (сабпат `@reformer/core/model`); `form` — узлы, поведение и
 * валидация поверх её сигналов; `platforms/react` — биндинги в React, единственный слой с
 * рантайм-зависимостью от `react`. Состав экспортов зонтика не меняется при реорганизациях:
 * реализация разложена по слоям, а barrel по-прежнему отдаёт единую поверхность.
 */

// Общие + form типы (словарь значения/валидации — form/types/contracts).
export * from './form/types/index';
// Model-модуль: модель, producer-флаг, утилиты субстрата. Низкоуровневые операторы над сигналами
// (`computeFrom`, `copyFrom`, `watchField`, `transformValue`, `resetWhen`, `syncFields`,
// `revalidateWhen`) в зонтик не входят: поведение формы пишут операторами
// `@reformer/core/behaviors`, а сами примитивы остаются в сабпате `@reformer/core/model`.
export { createModel, eachLeafSignal, eachValueSignal } from './model/create-model';
export { arrayOf } from './model/model-nodes';
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
} from './model/types';
export { isModelContainerSignal, isValueSignal } from './model/model-signals-proxy';
export { modelOf } from './model/model-value-proxy';
export type { ModelOf } from './model/model-value-proxy';
export type { BehaviorCleanup } from './model/behaviors-value';
export { markDerived, isDerived, unmarkDerived } from './model/derived-registry';
export { runOutsideEffect, safeCallback, safeDebouncedCallback } from './model/safe-effect';
// Form-модуль: ноды, createForm, submit
// (schema-валидация — отдельный сабпат @reformer/core/validation).
export * from './form/index';
// React-биндинги: единственный слой с runtime-зависимостью от react.
export * from './platforms/react/index';
// Правила берите из сабпата — `@reformer/core/validators` (весь набор) либо гранулярно
// (`@reformer/core/validators/required`), это ещё и лучше тришейкается.

// Штамп копии рантайма — для guard'а от двойной загрузки ядра (@reformer/form-registry/guard).
export { CORE_RUNTIME_TOKEN } from './runtime-token';
