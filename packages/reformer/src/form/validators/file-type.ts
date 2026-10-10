/**
 * Валидатор типа файла по accept-паттерну (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/file-type
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { matchesFileAccept, toFileArray } from './file-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора типа файла.
 *
 * Проверяет каждый файл против accept-строки в синтаксисе нативного атрибута
 * `<input type="file" accept>`: расширения (`.pdf`), точные MIME (`image/png`),
 * wildcard-категории (`image/*`), список через запятую. Матчинг регистронезависимый,
 * по `type` и/или расширению из `name` ({@link matchesFileAccept}).
 *
 * Нужен потому, что нативный `accept` — только подсказка пикеру: на drag-and-drop
 * и «All files» он не действует. Пустые значения (`null`/`undefined`/`''`/`[]`)
 * пропускаются (используйте {@link required} для обязательности).
 *
 * @param accept - Accept-строка допустимых типов, например `'image/*,.pdf'`
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `accept` и `fileName` (первый нарушивший файл).
 * @returns Правило {@link Rule} для файла или массива файлов
 *
 * @example Только изображения и PDF
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { fileType } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.documents, [fileType('image/*,.pdf', { code: 'documents.fileType' })]);
 * });
 * ```
 */
export function fileType(accept: string, options?: RuleOptions): Rule<unknown> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null || files.length === 0) return null;
    for (const file of files) {
      if (!matchesFileAccept(file, accept)) {
        return validationIssue('fileType', options, { accept, fileName: file.name });
      }
    }
    return null;
  };
}
