/**
 * Детект незарегистрированных `$component(NAME)` в схеме (спека §13 риск #5, §14 «неизвестный
 * компонент → generic box»). Чистая функция — разность имён компонентов схемы и известного набора.
 *
 * @module reformer-builder/preview-runtime/unknown
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { collectOperatorNames } from '../model';
import { knownComponentNameSet } from './known-names';

/** Имена `$component(...)`, которых нет в дефолтном ui-kit-реестре preview. */
export function collectUnknownComponentNames(schema: JsonFormSchema): string[] {
  const known = knownComponentNameSet();
  return collectOperatorNames(schema).components.filter((n) => !known.has(n));
}
