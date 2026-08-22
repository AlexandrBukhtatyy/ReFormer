/**
 * Валидатор суммарного размера файлов (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max-total-file-size
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';
import { toFileArray } from './file-utils';

/**
 * Фабрика валидатора суммарного размера всех файлов.
 *
 * Складывает `size` всех файлов значения (элементы без числового `size` в сумму
 * не входят). Пустые значения (`null`/`undefined`/`''`/`[]`) пропускаются
 * (используйте {@link required} для обязательности).
 *
 * @param maxTotal - Максимально допустимый суммарный размер в байтах (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `maxTotalFileSize` и `actualTotal`.
 * @returns Чистый валидатор {@link Validator} для файла или массива файлов
 *
 * @example Суммарно не более 20 МБ
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { maxTotalFileSize } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.documents, [maxTotalFileSize(20 * 1024 * 1024, { message: 'Суммарно не более 20 МБ' })]);
 * });
 * ```
 */
export function maxTotalFileSize<TForm = unknown, TField = unknown>(
  maxTotal: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null || files.length === 0) return null;
    const actualTotal = files.reduce(
      (sum, file) => sum + (typeof file.size === 'number' ? file.size : 0),
      0
    );
    if (actualTotal > maxTotal) {
      return {
        code: 'maxTotalFileSize',
        message: options?.message ?? 'invalid',
        params: { maxTotalFileSize: maxTotal, actualTotal, ...options?.params },
      };
    }
    return null;
  };
}
