/**
 * Валидатор максимального количества файлов (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max-files
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { toFileArray } from './file-utils';
import { validationError } from './validation-error';

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
 * @returns Правило {@link Rule} для файла или массива файлов
 *
 * @example Не более трёх вложений
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { maxFiles } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.documents, [maxFiles(3, { message: 'Максимум 3 файла' })]);
 * });
 * ```
 */
export function maxFiles(max: number, options?: ValidateOptions): Rule<unknown> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null || files.length === 0) return null;
    if (files.length > max) {
      return validationError('maxFiles', options, { maxFiles: max, actualCount: files.length });
    }
    return null;
  };
}
