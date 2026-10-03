/**
 * Сборка ошибки валидации — общая для всех правил каталога.
 *
 * Правило несёт только `code` и `params`: готового текста у него нет, поэтому `message` по
 * умолчанию пуст, и отображаемую строку даёт резолвер по коду (см. `resolveValidationError` в
 * `@reformer/core/i18n`). Пустое `message` — это и есть признак «автор текста не задавал»: по нему
 * резолвер отличает явное сообщение правила от умолчания.
 *
 * @module form/validators/validation-error
 */

import type { FormValue, ValidationError } from '../types/contracts';
import type { ValidateOptions } from '../types/validation-schema';

/**
 * @param code - Код ошибки; по нему ищется текст в словаре локали (`validation.<code>`).
 * @param options - Опции правила: явное сообщение, ключ сообщения, дополнительные параметры.
 * @param params - Параметры, которые правило заполняет само; параметры из `options` важнее.
 */
export function validationError(
  code: string,
  options: ValidateOptions | undefined,
  params?: Record<string, FormValue>
): ValidationError {
  const error: ValidationError = {
    code,
    message: options?.message ?? '',
    params: params === undefined ? options?.params : { ...params, ...options?.params },
  };
  if (options?.messageKey !== undefined) error.messageKey = options.messageKey;
  return error;
}
