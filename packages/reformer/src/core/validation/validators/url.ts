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

export interface UrlValidatorOptions extends ValidateOptions {
  /** Требовать наличие протокола (http:// или https://) */
  requireProtocol?: boolean;
  /** Разрешенные протоколы */
  allowedProtocols?: string[];
}

/**
 * Фабрика валидатора URL.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.website, url());
 * validate(path.website, url({ requireProtocol: true }));
 * validate(path.website, url({ allowedProtocols: ['https'] }));
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
