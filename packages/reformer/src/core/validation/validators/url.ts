/**
 * URL format validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для URL валидатора
 * Поддерживает опциональные поля (string | undefined)
 *
 * @example
 * ```typescript
 * url(path.website);
 * url(path.website, { message: 'Введите корректный URL' });
 * url(path.website, { requireProtocol: true });
 * ```
 */
export function url<TForm = any, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions & {
    /** Требовать наличие протокола (http:// или https://) */
    requireProtocol?: boolean;
    /** Разрешенные протоколы */
    allowedProtocols?: string[];
  }
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  // URL regex с опциональным протоколом
  const urlRegexWithProtocol =
    /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  const urlRegexRequireProtocol = /^https?:\/\/([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    const regex = options?.requireProtocol ? urlRegexRequireProtocol : urlRegexWithProtocol;

    if (!regex.test(value)) {
      return {
        code: 'url',
        message: options?.message || 'Неверный формат URL',
        params: options?.params,
      };
    }

    // Проверка разрешенных протоколов
    if (options?.allowedProtocols && options.allowedProtocols.length > 0) {
      const hasAllowedProtocol = options.allowedProtocols.some((protocol) =>
        value.toLowerCase().startsWith(`${protocol}://`)
      );

      if (!hasAllowedProtocol) {
        return {
          code: 'url_protocol',
          message:
            options?.message ||
            `URL должен использовать один из протоколов: ${options.allowedProtocols.join(', ')}`,
          params: { allowedProtocols: options.allowedProtocols, ...options?.params },
        };
      }
    }

    return null;
  });
}