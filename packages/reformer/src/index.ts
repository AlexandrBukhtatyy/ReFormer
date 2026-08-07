/**
 * Публичный barrel `@reformer/core` — зонтик над модулями `model` (state) и `form`.
 *
 * Состав экспортов НЕ изменился при модуляризации (реорг в src/model + src/form): реализация
 * разложена по модулям, а этот barrel по-прежнему отдаёт единую поверхность.
 */

// Общие + form типы (контракты значения/валидации реэкспортятся из model/contracts).
export * from './form/types/index';
// Фабрики нод.
export * from './form/factories/index';
// State-модуль: модель, value-операции, headless-валидация, producer-флаг, утилиты субстрата.
export * from './state/index';
// Form-модуль: ноды, createForm, enableWhen/disableWhen, submit, хуки
// (schema-валидация — отдельный сабпат @reformer/core/validation).
export * from './form/index';
// Validators namespace удалён в 7.0: `import { validators } from '@reformer/core'` больше нет.
// Правила берите из сабпата — `@reformer/core/validators` (весь набор) либо гранулярно
// (`@reformer/core/validators/required`), это ещё и лучше тришейкается.

// Штамп копии рантайма — для guard'а от двойной загрузки ядра (@reformer/form-registry/guard).
export { CORE_RUNTIME_TOKEN } from './runtime-token';
