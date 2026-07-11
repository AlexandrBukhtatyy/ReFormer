/**
 * Типы для validation schema.
 *
 * Валидаторы — чистые функции `(value, scope, root) => error | null`. Не знают про реестр,
 * импортируются как фабрики из `@reformer/core/validators` и кладутся в поле `validators`
 * узла схемы; вызывает их движок M1 (`validateModel`/`validateFormModel`).
 *
 * Legacy-движок операторов регистрации (`validate`/`validateAsync`/`applyWhen`/…) удалён после Ф7
 * (см. `core/validation/index.ts`). Типы {@link AsyncValidator}, {@link ConditionFn} и
 * {@link ValidateAsyncOptions} ниже — осиротевшие остатки той поверхности: они экспортируются
 * ради обратной совместимости, но рантаймом уже не потребляются (живой async-путь использует
 * `AsyncValidatorFn` из узла поля).
 *
 * См. docs/plans/atomic-meandering-wreath.md для деталей.
 */

import type { FormValue, ValidationError } from './index';
import type { FormModel } from '../../state/types';

// ============================================================================
// Validator types (чистые функции)
// ============================================================================

/**
 * Чистый синхронный валидатор поля.
 *
 * Сигнатура зеркалит то, что реально вызывает движок M1
 * (`validateModel`/`validateFormModel`/`validateModelSync`): `validator(value, scope, root)`.
 * - `value` — значение поля (`TField`);
 * - `scope` — ближайшая scope-**модель** (под-модель элемента массива или корень). Из `TForm`/`TField`
 *   её тип не выводится, поэтому `unknown` — потребитель сужает сам (для типизированного scope
 *   используйте {@link ModelValidator}`<TField, TScope, TForm>`);
 * - `root` — корневая модель формы `FormModel<TForm>` (реактивный value-proxy: `root.field` читает
 *   значение). Возвращает `ValidationError` либо `null`. Не знает про реестр валидации.
 *
 * Совместим с полем `validators` узла схемы (см. `SchemaValidator`) — там же лежат `ModelValidator`
 * и `ValidatorFn`. Встроенные фабрики (`required()`/`email()`/…) возвращают `(value) => …` и
 * дополнительные аргументы игнорируют.
 *
 * @example Кастомный валидатор в массиве `validators` поля схемы
 * ```typescript
 * const isAdult: Validator<MyForm, number> = (value, _scope, root) => {
 *   if (value < 18) return { code: 'tooYoung', message: '18+' };
 *   // root — FormModel<MyForm>: root.someOtherField читается как значение
 *   return null;
 * };
 *
 * // Фабрики и кастомные валидаторы кладутся в `validators: [...]` поля:
 * const schema = {
 *   children: [
 *     { value: model.$.age, component: Input, validators: [required(), isAdult] },
 *   ],
 * };
 * ```
 */
export type Validator<TForm, TField> = (
  value: TField,
  scope: unknown,
  root: FormModel<TForm>
) => ValidationError | null;

/**
 * Чистый асинхронный валидатор поля. Та же тройка аргументов `(value, scope, root)`, что у
 * {@link Validator}, но возвращает `Promise`.
 *
 * @deprecated Осиротевший остаток удалённого оператора `validateAsync` (Ф7). Рантаймом не
 * потребляется — живой async-путь узла поля использует `AsyncValidatorFn` `(value, { signal })`.
 * Экспортируется только ради обратной совместимости.
 */
export type AsyncValidator<TForm, TField> = (
  value: TField,
  scope: unknown,
  root: FormModel<TForm>
) => Promise<ValidationError | null>;

/**
 * Функция-предикат `(value) => boolean`.
 *
 * @deprecated Осиротевший остаток удалённого оператора `applyWhen` (Ф7). Рантаймом не
 * потребляется; экспортируется только ради обратной совместимости.
 */
export type ConditionFn<T> = (value: T) => boolean;

// ============================================================================
// Опции валидации
// ============================================================================

/**
 * Опции валидатора-фабрики (`required()`/`pattern()`/…). Передаются вторым (или последним)
 * аргументом в фабрику и попадают в возвращаемую {@link ValidationError}.
 */
export interface ValidateOptions {
  /** Готовое сообщение об ошибке. Если не задано, валидаторы кладут `''`, и отображаемый текст
   * резолвится из `code` (см. резолвер сообщений в `@reformer/cdk`). */
  message?: string;
  /** Параметры ошибки (подстановка в шаблон сообщения / i18n). */
  params?: Record<string, FormValue>;
}

/**
 * @deprecated Осиротевший остаток удалённого оператора `validateAsync` (Ф7): опция `debounce`
 * подключалась тем оператором, которого больше нет. Рантаймом не потребляется; экспортируется
 * только ради обратной совместимости.
 */
export interface ValidateAsyncOptions extends ValidateOptions {
  /** Задержка перед выполнением валидации (в мс). */
  debounce?: number;
}
