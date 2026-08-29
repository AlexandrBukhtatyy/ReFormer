/**
 * `list_components` — единственный легальный источник имён компонентов.
 *
 * @module plugins/ai/core/tools/list-components
 */

import type { CatalogRole } from '@/lib/catalog/types';
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
    // Правило «имена берутся отсюда» перенесено в системный промпт, где заодно перечислены поля
    // этого кита: чаще всего список уже известен и вызов не нужен.
    'Components available in this editor build: name, role (field/container/array) and category.',
  inputSchema: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['field', 'container', 'array'],
        description: 'Keep only components with this role',
      },
      query: {
        type: 'string',
        description: 'Substring of the name or category, case-insensitive',
      },
    },
    additionalProperties: false,
  },
  readOnly: true,
  run(params, ctx) {
    // Про скрытые части говорим прямо: молчание читалось бы как «их в каталоге нет», и модель
    // собирала бы вкладки из первых попавшихся контейнеров. Приписка только там, где части
    // действительно скрыты, — с `query` они в выборке есть.
    const hint = params.query ? '' : PARTS_HIDDEN_HINT;
    const text = renderComponentList(
      listComponents(ctx.catalog, params),
      TOOL_TEXT_BUDGET - hint.length
    );
    return ok(hint ? `${text}\n${hint}` : text);
  },
};

/** Приписка к неотфильтрованному списку: почему в нём нет частей и как их найти. */
const PARTS_HIDDEN_HINT =
  'Parts of composite components (TabsList, TabsTrigger, CardHeader…) are hidden from this list: ' +
  'they are created together with their root. To see them, query by the root name (e.g. tabs).';
