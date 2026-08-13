/**
 * `list_components` — единственный легальный источник имён компонентов.
 *
 * @module reformer-builder/agent/core/tools/list-components
 */

import type { CatalogRole } from '../../../catalog';
import { listComponents, renderComponentList } from '../catalog-digest';
import { ok, TOOL_TEXT_BUDGET, type AgentTool } from '../types';

/** Параметры вызова. */
interface Params {
  role?: CatalogRole;
  query?: string;
}

export const listComponentsTool: AgentTool<Params> = {
  name: 'list_components',
  description:
    'Компоненты, доступные в этой сборке редактора: имя, роль (field/container/array) и категория. ' +
    'Имена компонентов бери ТОЛЬКО отсюда — выдуманное имя будет отклонено гейтом. ' +
    'Сужай выборку параметрами role и query.',
  inputSchema: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['field', 'container', 'array'],
        description: 'Оставить только компоненты этой роли',
      },
      query: {
        type: 'string',
        description: 'Подстрока имени или категории, регистронезависимо',
      },
    },
    additionalProperties: false,
  },
  readOnly: true,
  run(params) {
    return ok(renderComponentList(listComponents(params), TOOL_TEXT_BUDGET));
  },
};
