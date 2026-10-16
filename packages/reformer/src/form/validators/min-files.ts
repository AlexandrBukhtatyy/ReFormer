/**
 * Валидатор минимального количества файлов (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min-files
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { toFileArray } from './file-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора минимального количества файлов.
 *
 * Работает с массивом файлов (одиночный файл считается как 1). Пустые значения
 * (`null`/`undefined`/`''`) пропускаются (используйте {@link required}), а пустой массив — как
 * у {@link minLength} — проверяется: при `min > 0` это замечание с `actualCount: 0`. Элементы
 * массива, которые не файлы, не считаются.
 *
 * @param min - Минимально допустимое количество файлов (включительно)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `minFiles` и `actualCount`.
 * @returns Правило {@link Rule} для файла или массива файлов
 *
 * @example Не менее двух документов
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, minFiles } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.documents, [required(), minFiles(2, { code: 'documents.minFiles' })]);
 * });
 * ```
 */
export function minFiles(min: number, options?: RuleOptions): Rule<unknown> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null) return null;
    if (files.length < min) {
      return validationIssue('minFiles', options, { minFiles: min, actualCount: files.length });
    }
    return null;
  };
}
