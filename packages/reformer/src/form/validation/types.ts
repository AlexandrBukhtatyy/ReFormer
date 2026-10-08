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

import type { FormModel, PathAwareSignal } from '../../model/types';
import type { ValidationError } from '../types/contracts';

/**
 * Синхронное правило поля типа `TField`: получает значение, возвращает ошибку или `null`.
 *
 * Правило, написанное для более широкого типа, подходит полю с более узким: `min()` принимает
 * `number | null | undefined` и годится и полю `number`, и полю `number | null`; `required()`
 * принимает любое значение. Обратное — ошибка компиляции: `validate(model.$.age, [email()])`
 * подсветится, потому что `email` ждёт строку, а поле числовое.
 *
 * Правило над несколькими полями — оператор `cross` области схемы: он получает снимок модели.
 *
 * @example
 * ```ts
 * const AMOUNT_RULES: Rule<number | null>[] = [required(), min(50000)];
 * const notReserved: Rule<string> = (value) =>
 *   value === 'admin' ? { code: 'reserved', message: 'Имя занято системой' } : null;
 * ```
 */
export type Rule<TField> = (value: TField) => ValidationError | null;

/**
 * Асинхронное правило поля. Получает `AbortSignal` для отмены устаревших ответов (быстрый повторный
 * прогон той же схемы отменяет предыдущий).
 *
 * Отклонённое правило (сеть, исключение) — это сбой проверки, а не «ошибок нет»: прогон получает
 * статус `error`, поле — блокирующую ошибку `ruleFailed`. Если недоступность сервиса не должна
 * мешать отправке, ловите ошибку в правиле и возвращайте `null` — это решение автора правила.
 */
export type AsyncRule<TField> = (
  value: TField,
  ctx: { signal: AbortSignal }
) => Promise<ValidationError | null>;

/**
 * Область схемы валидации — то, что схема получает аргументом.
 *
 * В корне прогона область — вся форма; в схеме, подключённой через `apply` / `applyEach`, —
 * под-модель группы или строки массива. Поэтому правила подформы пишутся один раз и не знают, где
 * она стоит.
 */
export interface ValidationScope<T> {
  /** Модель области. Привязки правил — через её `$`: `validate(model.$.email, [...])`. */
  readonly model: FormModel<T>;
  /**
   * Правило над несколькими полями: `check` получает снимок модели области (`model.get()`) и
   * вешает ошибку на поле `handle`. Тип снимка выведен из схемы — приводить его не нужно.
   *
   * @example
   * ```ts
   * defineValidationSchema<Loan>(({ model, cross }) => {
   *   cross(model.$.initialPayment, (loan) =>
   *     loan.initialPayment > loan.propertyValue ? tooHigh : null
   *   );
   * });
   * ```
   */
  cross(handle: PathAwareSignal<unknown>, check: (snapshot: T) => ValidationError | null): void;
}

/** Схема валидации — обычная функция над областью. First-class значение (можно `apply`/тестировать/переиспользовать). */
export type ValidationSchema<T> = (scope: ValidationScope<T>) => void;

/**
 * Чем закончился прогон схемы:
 *  - `valid` — блокирующих ошибок нет (`severity: 'warning'` не блокирует);
 *  - `invalid` — есть блокирующие ошибки;
 *  - `error` — хотя бы одно async-правило не вернуло результат (сеть, исключение);
 *  - `cancelled` — прогон устарел: для той же пары (model, schema) запущен следующий.
 *
 * Приоритет при нескольких причинах: `cancelled` → `error` → `invalid` → `valid`.
 */
export type ValidationStatus = 'valid' | 'invalid' | 'cancelled' | 'error';

/** Правило, которое не вернуло результат. */
export interface ValidationFailure {
  /** Ручка поля `model.$.…`, чьё правило отклонилось. */
  readonly handle: PathAwareSignal<unknown>;
  /** То, чем правило отклонилось (ошибка сети, исключение). */
  readonly error: unknown;
}

/** Результат прогона схемы валидации — см. `runValidation`. */
export interface ValidationResult {
  readonly status: ValidationStatus;
  /** Ошибки по ручке поля `model.$.…`; путь — метаданные ручки (`handle.__path`). */
  readonly errors: ReadonlyMap<PathAwareSignal<unknown>, readonly ValidationError[]>;
  /** Правила, которые не вернули результат (сеть, исключение). */
  readonly failures: readonly ValidationFailure[];
}
