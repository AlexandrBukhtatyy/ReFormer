/**
 * Декларативный контракт схемы поведения формы — `@reformer/core/behaviors`.
 *
 * Свободные операторы (`compute`/`copyFrom`/`enableWhen`/`onChange`/…) вызываются внутри
 * `defineFormBehavior(({ model, form }) => { … })` и САМИ регистрируют свои отписки в ambient-стоке —
 * автор схемы не видит ни массива `cleanups`, ни `.push`, ни вызовов через точку. Жизненным циклом
 * владеет форма (`createForm({ behavior })`). Операторы — тонкие обёртки над примитивами слоя данных
 * ({@link module:model/behaviors-value}); пользовательские операторы пишутся так же и неотличимы от встроенных.
 *
 * Граница ответственности: контракт НЕ управляет валидацией — это отдельный слой
 * (`defineValidationSchema` + раннер `validateModel` из `@reformer/core/validation`), он остаётся
 * владельцем `errors`. Это сделано намеренно. Для редких крайних случаев
 * behavior-driven валидации (cross-field, async-uniqueness) можно написать собственный оператор поверх
 * `effect`/`onChange` + `node.setErrors(...)` — он будет неотличим от встроенного; примеры см. в
 * tests/behaviors/web-scenarios (W1/W3). В общем случае правила валидности держите в слое валидации.
 *
 * Модуль разложен по зонам ответственности: `./types` — контракт схемы, `./context` — ambient-сток
 * и низкоуровневый набор авторинга, `./internals` — чистые утилиты, `./operators` — операторы над
 * полем и группой, `./collections` — операторы над массивами и под-моделями.
 *
 * @group Behaviors
 * @module form/behaviors
 */

// Контракт схемы.
export type { BehaviorScope, FormBehavior, ChangeContext } from './types';
export type { Signal, ReadonlySignal, BehaviorCleanup } from './types';

// Ambient-сток + низкоуровневый набор авторинга.
export { onDispose, getScope, defineFormBehavior, effect, defer } from './context';

// Операторы над полем и группой.
export {
  compute,
  computeFrom,
  copyFrom,
  onChange,
  enableWhen,
  disableWhen,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
} from './operators';

// Операторы над массивами и под-моделями.
export { applyEach, exclusiveFlag, aggregateInto, apply } from './collections';
