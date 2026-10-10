/**
 * Общие контракт-типы значения и валидации.
 *
 * Базовый словарь «замечание + статус», на который опираются узлы формы (`FieldNode`,
 * `FormStatusMachine`, `aggregate-signals`), слой валидации и платформенные биндинги. Файл не
 * импортирует ничего — это лист графа зависимостей.
 *
 * Живёт в `form/types/`, а не в слое модели: `FieldStatus` — понятие формы, а модель этих типов
 * не использует (и импортировать их оттуда запрещено границей model⇏form).
 * Наружу отдаётся через `form/types/index`.
 *
 * @group Types
 * @module form/types/contracts
 */

/**
 * Замечание валидации: что нарушено (`code`) и с какими числами (`params`). Текста у замечания
 * нет — отображаемую строку по коду даёт слой представления (`resolveIssueMessage` из
 * `@reformer/core/i18n`): словарь формы → словарь локали → встроенный английский → сам код.
 * Поэтому одно и то же замечание показывается на любом языке без повторной проверки.
 *
 * @example
 * ```ts
 * const tooShort: ValidationIssue = { code: 'minLength', params: { minLength: 8 } };
 * const softLimit: ValidationIssue = { code: 'loanAmount.high', severity: 'warning' };
 * ```
 *
 * @group Types
 * @category Validation Types
 */
export interface ValidationIssue {
  /** Код правила: встроенный (`required`, `minLength`) либо свой (`loanAmount.required`). */
  readonly code: string;
  /** Значения для подстановки в текст: порог правила, фактическое значение. */
  readonly params?: Readonly<Record<string, unknown>>;
  /** `'error'` (по умолчанию) блокирует отправку, `'warning'` показывается, но не блокирует. */
  readonly severity?: 'error' | 'warning';
}

/**
 * Статус поля формы
 * @group Types
 * @category Core Types
 */
export type FieldStatus = 'valid' | 'invalid' | 'pending' | 'disabled';
