/**
 * Штамп копии рантайма ядра.
 *
 * Единственное назначение — быть объектом, уникальным в пределах ОДНОЙ копии модуля. Две
 * независимо загруженные копии `@reformer/core` дадут два разных объекта, и по их несовпадению
 * guard распознаёт дубль рантайма.
 *
 * Почему именно объект, а не строка с версией: две копии ОДНОЙ версии ломают всё ровно так же,
 * как две копии разных версий, — раздваиваются модульные `WeakMap` (`derived-registry`,
 * `signal-node-registry`) и перестают работать проверки `instanceof Signal`. Сравнение версий
 * такой случай пропустило бы.
 *
 * @see `@reformer/form-registry/guard`
 *
 * @example
 * ```ts
 * import { CORE_RUNTIME_TOKEN } from '@reformer/core';
 * import { stampRuntime } from '@reformer/form-registry/guard';
 *
 * stampRuntime('@reformer/core', CORE_RUNTIME_TOKEN);
 * ```
 */
export const CORE_RUNTIME_TOKEN: object = Object.freeze({ runtime: 'reformer-core', v: 1 });
