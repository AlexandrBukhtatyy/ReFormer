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
// Form-модуль: ноды, createForm, enableWhen/disableWhen, validateFormModel, submit, хуки.
export * from './form/index';
// Validators namespace (чистые фабрики).
export * as validators from './form/validation/index';
