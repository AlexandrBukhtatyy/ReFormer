/**
 * Типы для validation schema (legacy-поверхность).
 *
 * Живой контракт валидации — `@reformer/core/validation`: `defineValidationSchema` + операторы
 * (`validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply`) и раннер
 * `validateModel(model, schema)`; правила там — `Rule<T> = (value) => error | null`.
 * Дерево-движок (`validateFormModel`/`validateModel`(tree)), читавший `validators` узлов схемы,
 * удалён — типы ниже остаются только как совместимость для node-level поверхности.
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
 * Чистый синхронный валидатор поля (legacy-сигнатура `(value, scope, root)`).
 *
 * @deprecated Осиротевший остаток удалённого дерево-движка (`validateFormModel`). Живой контракт —
 * `Rule<T> = (value) => ValidationError | null` из `@reformer/core/validation`: правила
 * передаются в `validate(sig, [rules])` внутри `defineValidationSchema` и запускаются
 * `validateModel(model, schema)`. Cross-field — оператор `cross(sig, (f) => …)` над снапшотом
 * `model.get()` (третий аргумент `root` больше не нужен). Тип экспортируется только ради
 * обратной совместимости (`SchemaValidator`-union).
 */
export type Validator<TForm, TField> = (
  value: TField,
  scope: unknown,
  root: FormModel<TForm>
) => ValidationError | null;

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
