/**
 * Создание типизированного FieldPath для Behavior Schema
 *
 * @deprecated Этот модуль устарел и будет удален в следующей мажорной версии.
 * Используйте импорт из '../utils/field-path' напрямую:
 *
 * ```typescript
 * // Вместо:
 * import { createFieldPath } from '@reformer/behavior/create-field-path';
 *
 * // Используйте:
 * import { createFieldPath } from '@reformer/utils';
 * ```
 *
 * @see {@link ../utils/field-path.createFieldPath}
 */

import { createFieldPath as _createFieldPath } from '../utils/field-path';

let warned = false;

/**
 * @deprecated Используйте createFieldPath из '../utils/field-path'
 */
export const createFieldPath: typeof _createFieldPath = (...args) => {
  if (!warned && typeof console !== 'undefined') {
    warned = true;
    console.warn(
      '[ReFormer] createFieldPath из behavior/create-field-path устарел. ' +
        'Импортируйте из utils/field-path напрямую.'
    );
  }
  return _createFieldPath(...args);
};
