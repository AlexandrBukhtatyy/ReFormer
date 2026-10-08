/**
 * Типы фабрик валидаторов (`@reformer/core/validators`).
 *
 * Контракт валидации — `@reformer/core/validation`: `defineValidationSchema` + операторы
 * (`validate`/`validateAsync`/`validateWhen`/`cross`/`apply`/`applyEach`) и раннер
 * `validateModel(model, schema)`; правила там — `Rule<T> = (value) => error | null`.
 */

import type { FormValue } from './index';

// ============================================================================
// Опции валидации
// ============================================================================

/**
 * Опции валидатора-фабрики (`required()`/`pattern()`/…). Передаются вторым (или последним)
 * аргументом в фабрику и попадают в возвращаемую {@link ValidationError}.
 */
export interface ValidateOptions {
  /** Готовое сообщение об ошибке. Если не задано, у ошибки нет `message`, и отображаемый текст
   * берётся из словаря локали по `code` (`validation.<code>`; см. `resolveValidationError` в
   * `@reformer/core/i18n`). Явное сообщение важнее словаря, но не переключается вместе с языком —
   * для локализуемого текста используйте {@link ValidateOptions.messageKey}. */
  message?: string;
  /**
   * Ключ сообщения в словаре приложения — локализуемый текст автора правила. Если ключ есть в
   * активной локали, он важнее и `message`, и текста по `code`; если нет — в ход идёт `message`.
   *
   * @example
   * ```ts
   * required({ messageKey: 'profile.name.required', message: 'Name is required' });
   * ```
   */
  messageKey?: string;
  /** Параметры ошибки (подстановка в шаблон сообщения / i18n). */
  params?: Record<string, FormValue>;
}
