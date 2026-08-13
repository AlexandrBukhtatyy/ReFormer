/**
 * `describe_component` — свойства одного компонента, чтобы не выдумывать имена пропсов.
 *
 * @module reformer-builder/agent/core/tools/describe-component
 */

import { collectOperatorNames } from '../../../model';
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
    'Свойства компонента: ключ, тип значения, допустимые значения и значение по умолчанию. ' +
    'Вызывай перед тем, как задавать componentProps, — имена пропсов у разных китов различаются.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Имя компонента из list_components' },
    },
    required: ['name'],
    additionalProperties: false,
  },
  readOnly: true,
  run(params, ctx) {
    const detail = describeComponent(params.name);
    if (detail) return ok(renderComponentDetail(detail, TOOL_TEXT_BUDGET));

    // Компонент из реестра конкретного проекта: каталогу билдера он неизвестен, но в открытой форме
    // законен и гейтом пропускается (`io/validate` знает его через baseline). Корень реальных схем —
    // как раз такой (`RendererFormWizard`), и ответ «нет в каталоге» на узел, который прямо сейчас
    // стоит в форме, читается как «форма сломана» и уводит в бесполезную разведку.
    if (collectOperatorNames(ctx.draft).components.includes(params.name)) {
      return ok(
        `${params.name} — компонент из реестра проекта, а не из каталога редактора. Его свойства ` +
          `здесь неизвестны: посмотри узел через get_form_node. Существующие такие узлы править ` +
          `можно, вставить новый — нет.`
      );
    }

    return fail(
      'UNKNOWN_COMPONENT',
      `Компонента "${params.name}" нет в каталоге. Возьми имя из list_components.`,
      similarNames(params.name, componentNames())
    );
  },
};
