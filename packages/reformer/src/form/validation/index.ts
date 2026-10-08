/**
 * Декларативный контракт СХЕМЫ ВАЛИДАЦИИ — `@reformer/core/validation`.
 *
 * Схема валидации — обычная функция `({ model, cross }) => void`. Внутри вызываются свободные операторы
 * (`validate`/`validateAsync`/`validateWhen`/`apply`/`applyEach`) и `cross` области, которые САМИ пишут ошибки в
 * ambient-сток текущего прогона — автор не видит ни коллектора, ни `getNodeForSignal`, ни `.push`.
 * Раннер открывает ambient-окно на время СИНХРОННОГО прогона схемы и дожидается async-правил
 * ({@link runValidation} — сбор результата), затем разносит ошибки по нодам формы, гася поля, ставшие
 * валидными ({@link applyValidationResult}); {@link validateModel} делает оба шага и отвечает `boolean`.
 *
 * Зеркалит контракт поведения (`@reformer/core/behaviors`): тот же ambient-стиль, но отдельный слой —
 * валидация НЕ реактивна (прогон по требованию: submit/шаг), поведение — реактивно (живые подписки).
 *
 * Модуль разложен по зонам ответственности: `./types` — контракт правил и схемы, `./context` —
 * ambient-сток прогона, `./operators` — операторы схемы, `./run` — раннер, `./strategy` — КОГДА
 * запускать (реэкспортируется отсюда, тот же сабпат).
 *
 * @group Validation
 * @module form/validation
 */

// Контракт правил и схемы.
export type {
  Rule,
  AsyncRule,
  ValidationSchema,
  ValidationScope,
  ValidationStatus,
  ValidationFailure,
  ValidationResult,
} from './types';

// Операторы схемы (вызываются внутри defineValidationSchema).
export { validate, validateAsync, validateWhen, apply, applyEach } from './operators';

// Определение схемы + раннер: сбор результата, разнос по нодам и оба шага одним вызовом.
export { defineValidationSchema, runValidation, applyValidationResult, validateModel } from './run';

// Единый декларативный выбор стратегии валидации (createFormValidation + типы) — тот же сабпат.
export * from './strategy';
