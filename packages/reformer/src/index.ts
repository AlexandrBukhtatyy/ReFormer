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
// Фабрики нод.
export * from './form/factories/index';
// Model-модуль: модель, value-операции, producer-флаг, утилиты субстрата.
export * from './model/index';
// Form-модуль: ноды, createForm, enableWhen/disableWhen, submit
// (schema-валидация — отдельный сабпат @reformer/core/validation).
export * from './form/index';
// React-биндинги: единственный слой с runtime-зависимостью от react.
export * from './platforms/react/index';
// Validators namespace удалён в 7.0: `import { validators } from '@reformer/core'` больше нет.
// Правила берите из сабпата — `@reformer/core/validators` (весь набор) либо гранулярно
// (`@reformer/core/validators/required`), это ещё и лучше тришейкается.

// Штамп копии рантайма — для guard'а от двойной загрузки ядра (@reformer/form-registry/guard).
export { CORE_RUNTIME_TOKEN } from './runtime-token';
