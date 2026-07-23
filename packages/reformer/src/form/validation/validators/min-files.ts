/**
 * Валидатор минимального количества файлов (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/minFiles
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { toFileArray } from './file-utils';

/**
 * Фабрика валидатора минимального количества файлов.
 *
 * Работает с массивом файлов (одиночный файл считается как 1). Пустые значения
 * (`null`/`undefined`/`''`/`[]`) пропускаются — «нужен хотя бы один файл» выражается
 * связкой `required()` + `minFiles(n)`, как и у {@link minLength}.
 *
 * @param min - Минимально допустимое количество файлов (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `minFiles` и `actualCount`.
 * @returns Чистый валидатор {@link Validator} для файла или массива файлов
 *
 * @example Не менее двух документов
 * ```typescript
 * import { required, minFiles } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * documents: {
 *   value: model.$.documents,
 *   component: FileUploadField,
 *   validators: [required(), minFiles(2, { message: 'Приложите минимум 2 документа' })],
 * },
 * ```
 */
export function minFiles<TForm = unknown, TField = unknown>(
  min: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null || files.length === 0) return null;
    if (files.length < min) {
      return {
        code: 'minFiles',
        message: options?.message ?? 'invalid',
        params: { minFiles: min, actualCount: files.length, ...options?.params },
      };
    }
    return null;
  };
}
