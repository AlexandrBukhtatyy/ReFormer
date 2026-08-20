/**
 * Декларативный контракт СХЕМЫ ВАЛИДАЦИИ — `@reformer/core/validation`.
 *
 * Схема валидации — обычная функция `(ctx: { model }) => void`. Внутри вызываются свободные операторы
 * (`validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`), которые САМИ пишут ошибки в ambient-сток
 * текущего прогона — автор не видит ни коллектора, ни `getNodeForSignal`, ни `.push`. Внешний раннер
 * {@link validateModel} открывает ambient-окно на время СИНХРОННОГО прогона схемы, дожидается async-правил
 * и разносит ошибки по нодам формы (`getNodeForSignal(sig).setErrors(...)`), гася поля, ставшие валидными.
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
export type { Rule, AsyncRule, ValidationSchema } from './types';

// Операторы схемы (вызываются внутри defineValidationSchema).
export { validate, validateAsync, validateWhen, cross, each, apply } from './operators';

// Определение схемы + внешний раннер.
export { defineValidationSchema, validateModel } from './run';

// Единый декларативный выбор стратегии валидации (createFormValidation + типы) — тот же сабпат.
export * from './strategy';
