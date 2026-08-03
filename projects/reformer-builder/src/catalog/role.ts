/**
 * Эвристика роли записи каталога (спека §5: `role` = field | container | array).
 *
 * В props-компаньонах ui-kit явного `role` пока нет (спека §15 — M3-follow-up), поэтому в MVP
 * роль выводится из формы схемы: наличие seam `x-runtimeProps.value` = form-control (field);
 * иначе — контейнер (Box/Section). `array` — синтетическая запись (форма узла, а не ui-kit-компонент),
 * задаётся в `synthetic-entries.ts`.
 *
 * @module reformer-builder/catalog/role
 */

import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { CatalogRole } from './types';

/** Роль по props-схеме варианта: seam `value` → field, иначе container. */
export function inferRole(schema: PropsSchema): CatalogRole {
  const runtime = schema['x-runtimeProps'];
  return runtime != null && 'value' in runtime ? 'field' : 'container';
}
