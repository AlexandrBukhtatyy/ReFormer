/**
 * Типы фабрик валидаторов (`@reformer/core/validators`).
 *
 * Контракт валидации — `@reformer/core/validation`: `defineValidation` + операторы
 * (`validate`/`validateAsync`/`validateWhen`/`cross`/`apply`/`applyEach`) и раннер
 * `validateModel(model, definition)`; правила там — `Rule<T> = (value) => issue | null`.
 */

// ============================================================================
// Опции правила
// ============================================================================

/**
 * Опции валидатора-фабрики (`required()`/`pattern()`/…). Передаются вторым (или последним)
 * аргументом в фабрику и попадают в возвращаемое {@link ValidationIssue}.
 *
 * Текста среди опций нет: правило сообщает только код и параметры, а строку по коду даёт слой
 * представления (`resolveIssueMessage` из `@reformer/core/i18n`). Нужен свой текст для
 * конкретного поля — дайте правилу свой код и запись в словаре формы.
 *
 * @example
 * ```ts
 * // правило
 * required({ code: 'loanAmount.required' });
 * // словарь формы (`defineIssueMessages`)
 * const messages = defineIssueMessages({ 'loanAmount.required': 'Укажите сумму кредита' });
 * ```
 */
export interface RuleOptions {
  /**
   * Свой код вместо встроенного. По нему текст ищется сначала в словаре формы, затем в локали
   * (`validation.<code>`); принято именовать `<поле>.<правило>`.
   */
  code?: string;
  /** Дополнительные параметры замечания: подставляются в текст поверх параметров правила. */
  params?: Readonly<Record<string, unknown>>;
}
