/**
 * Валидатор минимального размера файла (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min-file-size
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';
import { toFileArray } from './file-utils';

/**
 * Фабрика валидатора минимального размера файла.
 *
 * Работает с одиночным файлом или массивом (`File` либо файлоподобный дескриптор с
 * `name`/`size`). Проверяется каждый файл; в ошибку попадает первый нарушивший.
 * Типовой сценарий — отсев пустых (0-байтовых) файлов: `minFileSize(1)`.
 * Пустые значения (`null`/`undefined`/`''`/`[]`) и элементы без числового `size`
 * пропускаются (используйте {@link required} для обязательности).
 *
 * @param minSize - Минимально допустимый размер файла в байтах (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `minFileSize`, `fileName` и `actualSize`.
 * @returns Чистый валидатор {@link Validator} для файла или массива файлов
 *
 * @example Отсев пустых файлов
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { minFileSize } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.documents, [minFileSize(1, { message: 'Файл пустой' })]);
 * });
 * ```
 */
export function minFileSize<TForm = unknown, TField = unknown>(
  minSize: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null || files.length === 0) return null;
    for (const file of files) {
      if (typeof file.size !== 'number') continue;
      if (file.size < minSize) {
        return {
          code: 'minFileSize',
          message: options?.message ?? 'invalid',
          params: {
            minFileSize: minSize,
            fileName: file.name,
            actualSize: file.size,
            ...options?.params,
          },
        };
      }
    }
    return null;
  };
}
