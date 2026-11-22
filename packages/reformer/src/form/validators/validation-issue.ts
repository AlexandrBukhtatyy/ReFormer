/**
 * Сборка замечания валидации — общая для всех правил каталога.
 *
 * Правило несёт только `code` и `params`: текста у него нет, отображаемую строку даёт резолвер
 * по коду (см. `resolveIssueMessage` в `@reformer/core/i18n`). Свой код из опций важнее встроенного:
 * так одно и то же правило получает разный текст у разных полей.
 *
 * @module form/validators/validation-issue
 */

import type { ValidationIssue } from '../types/contracts';
import type { RuleOptions } from '../types/validation-schema';

/**
 * @param code - Встроенный код правила; по нему ищется текст в словаре локали (`validation.<code>`).
 * @param options - Опции правила: свой код и дополнительные параметры.
 * @param params - Параметры, которые правило заполняет само; параметры из `options` важнее.
 */
export function validationIssue(
  code: string,
  options: RuleOptions | undefined,
  params?: Record<string, unknown>
): ValidationIssue {
  const merged = params === undefined ? options?.params : { ...params, ...options?.params };
  return merged === undefined
    ? { code: options?.code ?? code }
    : { code: options?.code ?? code, params: merged };
}
