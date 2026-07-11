/**
 * Валидатор URL (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/url
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

const URL_WITH_PROTOCOL = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
const URL_REQUIRE_PROTOCOL = /^https?:\/\/([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

/**
 * Опции валидатора {@link url}. Расширяют {@link ValidateOptions} (`message`, `params`)
 * настройками проверки протокола.
 */
export interface UrlValidatorOptions extends ValidateOptions {
  /** Требовать наличие протокола (`http://` или `https://`). По умолчанию `false`. */
  requireProtocol?: boolean;
  /**
   * Список разрешённых протоколов (без `://`), например `['https']`. Если задан,
   * значение с иным протоколом даёт ошибку с кодом `url_protocol`.
   */
  allowedProtocols?: string[];
}

/**
 * Фабрика валидатора URL.
 *
 * Пустые значения (`''`/`null`/`undefined`) пропускаются (используйте {@link required}
 * для обязательности). При `requireProtocol` протокол обязателен; `allowedProtocols`
 * дополнительно ограничивает набор допустимых протоколов.
 *
 * @param options - Опции валидатора {@link UrlValidatorOptions}
 * @returns Чистый валидатор {@link Validator} для строкового поля
 *
 * @example Проверка URL
 * ```typescript
 * import { required, url } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * website: {
 *   value: model.$.website,
 *   component: Input,
 *   validators: [required(), url({ message: 'Введите корректный URL' })],
 * },
 * // Требовать протокол и ограничить схему только https:
 * homepage: {
 *   value: model.$.homepage,
 *   component: Input,
 *   validators: [url({ requireProtocol: true, allowedProtocols: ['https'] })],
 * },
 * ```
 */
export function url<TForm = unknown, TField extends string | undefined = string>(
  options?: UrlValidatorOptions
): Validator<TForm, TField> {
  return (value) => {
    if (!value) {
      return null;
    }

    const v = value as string;
    const regex = options?.requireProtocol ? URL_REQUIRE_PROTOCOL : URL_WITH_PROTOCOL;

    if (!regex.test(v)) {
      return {
        code: 'url',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }

    if (options?.allowedProtocols && options.allowedProtocols.length > 0) {
      const hasAllowedProtocol = options.allowedProtocols.some((protocol) =>
        v.toLowerCase().startsWith(`${protocol}://`)
      );

      if (!hasAllowedProtocol) {
        return {
          code: 'url_protocol',
          message: options?.message ?? 'invalid',
          params: { allowedProtocols: options.allowedProtocols, ...options?.params },
        };
      }
    }

    return null;
  };
}
