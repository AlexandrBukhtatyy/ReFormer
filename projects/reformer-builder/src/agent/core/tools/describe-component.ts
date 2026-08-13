/**
 * `describe_component` — свойства одного компонента, чтобы не выдумывать имена пропсов.
 *
 * @module reformer-builder/agent/core/tools/describe-component
 */

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
  run(params) {
    const detail = describeComponent(params.name);
    if (!detail) {
      return fail(
        'UNKNOWN_COMPONENT',
        `Компонента "${params.name}" нет в каталоге. Возьми имя из list_components.`,
        similarNames(params.name, componentNames())
      );
    }
    return ok(renderComponentDetail(detail, TOOL_TEXT_BUDGET));
  },
};
