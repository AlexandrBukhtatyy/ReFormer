/**
 * Типы контракта схемы валидации.
 *
 * Правило (`Rule`/`AsyncRule`) проверяет ЗНАЧЕНИЕ поля и возвращает ошибку или `null`; схема
 * (`ValidationSchema`) — обычная функция над (под)моделью, внутри которой вызываются операторы.
 * Ни правила, ни схема ничего не знают про ноды формы: роутинг ошибок — дело раннера
 * (`./run`), сбор — дело ambient-стока (`./context`).
 *
 * @group Validation
 * @module form/validation/types
 */

import type { FormModel, ValidationError } from '../../index';

/**
 * Внутренний callable-вид правила: value-only фабрики игнорируют 2-й/3-й аргумент.
 *
 * @internal
 */
export type CallableRule = (
  value: unknown,
  model: unknown,
  root: unknown
) => ValidationError | null;

/**
 * Синхронное правило поля типа `TField`. Проверяется ТОЛЬКО значение (`value`).
 *
 * Позиционные `scope`/`root` помечены `never` намеренно: так встроенные value-only фабрики
 * (`required()`/`min()`/… — они `(value, model, root) => …`) и inline-правила `(value) => …`
 * ОБА присваиваются в `Rule<TField>[]` без `any`, при этом сохраняется проверка типа поля
 * (`validate(model.$.age, [email()])` подсветится — `email` ждёт `string`, поле `number`).
 * На вызове раннер приводит правило к callable и передаёт `(value, model, model)`.
 */
export type Rule<TField> = (value: TField, scope: never, root: never) => ValidationError | null;

/**
 * Асинхронное правило поля. Получает `AbortSignal` для отмены устаревших ответов (быстрый повторный
 * прогон той же схемы отменяет предыдущий). Сетевой сбой не должен блокировать — ловите и возвращайте `null`.
 */
export type AsyncRule<TField> = (
  value: TField,
  ctx: { signal: AbortSignal }
) => Promise<ValidationError | null>;

/** Схема валидации — обычная функция над (под)моделью. First-class значение (можно `apply`/тестировать/переиспользовать). */
export type ValidationSchema<T> = (ctx: { model: FormModel<T> }) => void;
