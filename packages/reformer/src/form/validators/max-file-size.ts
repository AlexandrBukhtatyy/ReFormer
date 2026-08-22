/**
 * Валидатор максимального размера файла (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max-file-size
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';
import { toFileArray } from './file-utils';

/**
 * Фабрика валидатора максимального размера файла.
 *
 * Работает с одиночным файлом или массивом (`File` либо файлоподобный дескриптор с
 * `name`/`size`). Проверяется каждый файл; в ошибку попадает первый нарушивший.
 * Пустые значения (`null`/`undefined`/`''`/`[]`) и элементы без числового `size`
 * (например, дескриптор загруженного файла без размера) пропускаются
 * (используйте {@link required} для обязательности).
 *
 * @param maxSize - Максимально допустимый размер файла в байтах (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `maxFileSize`, `fileName` и `actualSize`.
 * @returns Чистый валидатор {@link Validator} для файла или массива файлов
 *
 * @example Ограничение размера вложений
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { maxFileSize } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.documents, [maxFileSize(5 * 1024 * 1024, { message: 'Файл больше 5 МБ' })]);
 * });
 * ```
 */
export function maxFileSize<TForm = unknown, TField = unknown>(
  maxSize: number,
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
      if (file.size > maxSize) {
        return {
          code: 'maxFileSize',
          message: options?.message ?? 'invalid',
          params: {
            maxFileSize: maxSize,
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
