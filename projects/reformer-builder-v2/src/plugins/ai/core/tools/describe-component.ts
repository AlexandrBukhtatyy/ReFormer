/**
 * `describe_component` — свойства одного компонента, чтобы не выдумывать имена пропсов.
 *
 * @module plugins/ai/core/tools/describe-component
 */

import { collectOperatorNames } from '@/lib/form-model/query';
import { componentNames, describeComponent, renderComponentDetail } from '../catalog-digest';
import { similarNames } from '../suggest';
import { fail, ok, TOOL_TEXT_BUDGET, type AgentTool } from '../types';

/** Параметры вызова. */
interface Params {
  name: string;
}

export const describeComponentTool: AgentTool<Params> = {
  name: 'describe_component',
  description:
    'Properties of a component: key, value type, allowed values and default. Call it before ' +
    'setting componentProps — prop names differ between UI kits.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Component name from list_components' },
    },
    required: ['name'],
    additionalProperties: false,
  },
  readOnly: true,
  run(params, ctx) {
    const detail = describeComponent(ctx.catalog, params.name);
    if (detail) return ok(renderComponentDetail(detail, TOOL_TEXT_BUDGET));

    // Компонент из реестра конкретного проекта: каталогу билдера он неизвестен, но в открытой форме
    // законен и гейтом пропускается (строгий гейт знает его через baseline). Корень реальных схем —
    // как раз такой (`RendererFormWizard`), и ответ «нет в каталоге» на узел, который прямо сейчас
    // стоит в форме, читается как «форма сломана» и уводит в бесполезную разведку.
    if (collectOperatorNames(ctx.draft).components.includes(params.name)) {
      return ok(
        `${params.name} comes from the project registry, not from the editor catalog, so its ` +
          `properties are unknown here — inspect an existing node with get_form_node. You may ` +
          `edit such nodes, but you cannot insert new ones.`
      );
    }

    return fail(
      'UNKNOWN_COMPONENT',
      `No component "${params.name}" in the catalog. Take a name from list_components.`,
      similarNames(params.name, componentNames(ctx.catalog))
    );
  },
};
