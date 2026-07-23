/**
 * Валидатор максимального количества файлов (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/maxFiles
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { toFileArray } from './file-utils';

/**
 * Фабрика валидатора максимального количества файлов.
 *
 * Работает с массивом файлов (одиночный файл считается как 1). Пустые значения
 * (`null`/`undefined`/`''`/`[]`) пропускаются (используйте {@link required}
 * для обязательности).
 *
 * @param max - Максимально допустимое количество файлов (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `maxFiles` и `actualCount`.
 * @returns Чистый валидатор {@link Validator} для файла или массива файлов
 *
 * @example Не более трёх вложений
 * ```typescript
 * import { maxFiles } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * documents: {
 *   value: model.$.documents,
 *   component: FileUploadField,
 *   validators: [maxFiles(3, { message: 'Максимум 3 файла' })],
 * },
 * ```
 */
export function maxFiles<TForm = unknown, TField = unknown>(
  max: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null || files.length === 0) return null;
    if (files.length > max) {
      return {
        code: 'maxFiles',
        message: options?.message ?? 'invalid',
        params: { maxFiles: max, actualCount: files.length, ...options?.params },
      };
    }
    return null;
  };
}
