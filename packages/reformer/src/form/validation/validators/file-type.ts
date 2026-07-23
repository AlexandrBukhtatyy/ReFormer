/**
 * Валидатор типа файла по accept-паттерну (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/fileType
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { matchesFileAccept, toFileArray } from './file-utils';

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
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `accept` и `fileName` (первый нарушивший файл).
 * @returns Чистый валидатор {@link Validator} для файла или массива файлов
 *
 * @example Только изображения и PDF
 * ```typescript
 * import { fileType } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * documents: {
 *   value: model.$.documents,
 *   component: FileUploadField,
 *   validators: [fileType('image/*,.pdf', { message: 'Только изображения или PDF' })],
 * },
 * ```
 */
export function fileType<TForm = unknown, TField = unknown>(
  accept: string,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const files = toFileArray(value);
    if (files === null || files.length === 0) return null;
    for (const file of files) {
      if (!matchesFileAccept(file, accept)) {
        return {
          code: 'fileType',
          message: options?.message ?? 'invalid',
          params: { accept, fileName: file.name, ...options?.params },
        };
      }
    }
    return null;
  };
}
