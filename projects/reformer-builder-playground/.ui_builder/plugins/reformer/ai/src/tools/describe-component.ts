/**
 * `describe_component` — свойства компонентов, чтобы не выдумывать имена пропсов.
 *
 * Одно имя — полное описание (описания свойств, состав compound'а, скелет вставки). Несколько имён —
 * сжатая сводка по каждому одним вызовом: разведка спеки с десятью типами компонентов шла девятью
 * вызовами подряд, больше половины хода до первой правки (ReFormer-6sj).
 *
 * @module plugins/reformer/ai/tools/describe-component
 */

import { collectOperatorNames } from '../../../core/form-model';
import {
  commonProps,
  componentNames,
  describeComponent,
  renderComponentDetail,
  renderComponentSummary,
  type ComponentDetail,
} from '../model/catalog-digest';
import { similarNames } from '@reformer/builder-toolkit';
import { fail, ok, TOOL_TEXT_BUDGET, type AgentTool, type ToolContext } from '../model/types';

/** Параметры вызова. */
interface Params {
  name?: string;
  names?: string[];
}

/** Чем различаются экземпляры инструмента в двух режимах. */
interface DescribeToolOptions {
  /** Скелет вставки — дайджестом с адресами или готовым JSON узла. */
  readonly skeleton: 'outline' | 'json';
  /** Бюджет ответа: JSON-скелет длиннее дайджеста. */
  readonly budget: number;
  /** Где посмотреть узел компонента из реестра проекта. */
  readonly inspect: string;
}

/** Компонент из реестра проекта, который уже стоит в открытой форме. */
const inProjectRegistry = (name: string, ctx: ToolContext): boolean =>
  collectOperatorNames(ctx.draft).components.includes(name);

/**
 * `describe_component` для режима — структурного или файлового.
 *
 * Имя, описание и схема аргументов у обоих экземпляров ОДНИ: различается только ответ. Так
 * структурный экземпляр побайтно прежний, и храповик его поверхности не сдвигается.
 */
export function createDescribeComponentTool(options: DescribeToolOptions): AgentTool<Params> {
  // Ответ про компонент из реестра проекта: каталогу билдера он неизвестен, но в форме законен.
  const fromProjectRegistry = (name: string): string =>
    `${name} comes from the project registry, not from the editor catalog, so its properties are ` +
    `unknown here — ${options.inspect}. You may edit such nodes, but you cannot insert new ones.`;
  const budget = options.budget;
  const describeOptions = { skeleton: options.skeleton } as const;

  return {
    name: 'describe_component',
    description:
      'Properties of components: key, value type, allowed values and default. Call it before ' +
      'setting componentProps — prop names differ between UI kits. Several at once — names.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Component name from list_components' },
        names: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
          description: 'A line per component',
        },
      },
      additionalProperties: false,
    },
    readOnly: true,
    run(params, ctx) {
      const names = [...new Set(params.names ?? (params.name ? [params.name] : []))];
      if (names.length === 0) {
        return fail('INVALID_PARAMS', 'Pass name (one component) or names (several at once).');
      }

      if (names.length === 1) {
        const [name] = names;
        const detail = describeComponent(ctx.catalog, name, describeOptions);
        if (detail) return ok(renderComponentDetail(detail, budget));
        // Корень реальных схем — компонент реестра проекта (`RendererFormWizard`): ответ «нет в
        // каталоге» на узел, который прямо сейчас стоит в форме, читается как «форма сломана».
        if (inProjectRegistry(name, ctx)) return ok(fromProjectRegistry(name));
        return fail(
          'UNKNOWN_COMPONENT',
          `No component "${name}" in the catalog. Take a name from list_components.`,
          similarNames(name, componentNames(ctx.catalog))
        );
      }

      // Пачка: строка на компонент. Общие свойства роли (label, required, …) промпт перечисляет —
      // в сводке они опущены.
      const commonByRole = new Map<ComponentDetail['role'], Set<string>>();
      const commonOf = (role: ComponentDetail['role']): Set<string> => {
        let common = commonByRole.get(role);
        if (!common) commonByRole.set(role, (common = new Set(commonProps(ctx.catalog, role))));
        return common;
      };
      const lines = new Map<string, string>();
      const known: Array<{ name: string; render: (budget: number) => string }> = [];
      const unknown: string[] = [];
      for (const name of names) {
        const detail = describeComponent(ctx.catalog, name);
        if (detail) {
          const common = commonOf(detail.role);
          known.push({ name, render: (budget) => renderComponentSummary(detail, budget, common) });
        } else if (inProjectRegistry(name, ctx)) {
          lines.set(name, `${name}: from the project registry — ${options.inspect}`);
        } else unknown.push(name);
      }
      if (known.length === 0 && lines.size === 0) {
        return fail(
          'UNKNOWN_COMPONENT',
          `None of these is in the catalog: ${unknown.join(', ')}. Take names from list_components.`,
          similarNames(unknown[0], componentNames(ctx.catalog))
        );
      }
      // Пометка о неизвестных именах — до дележа бюджета: она идёт последней и при перерасходе
      // реестр отрезал бы именно её.
      if (unknown.length > 0) {
        const hints = unknown.map((name) => {
          const similar = similarNames(name, componentNames(ctx.catalog));
          return similar.length ? `${name} (did you mean ${similar.join(', ')}?)` : name;
        });
        lines.set('', `Not in the catalog: ${hints.join(', ')}.`);
      }
      // Бюджет — от коротких строк к длинным: остаток, который короткая не выбрала, достаётся длинным,
      // а не пропадает при равном дележе.
      let left = budget - [...lines.values()].reduce((sum, line) => sum + line.length + 1, 0);
      const byLength = [...known].sort(
        (a, b) => a.render(Infinity).length - b.render(Infinity).length
      );
      for (const [i, entry] of byLength.entries()) {
        const line = entry.render(Math.floor(left / (byLength.length - i)) - 1);
        lines.set(entry.name, line);
        left -= line.length + 1;
      }
      // Порядок — как в запросе.
      const ordered = [...names.filter((name) => lines.has(name)), ...(lines.has('') ? [''] : [])];
      return ok(ordered.map((name) => lines.get(name)).join('\n'));
    },
    ...(budget !== TOOL_TEXT_BUDGET ? { textBudget: budget } : {}),
  };
}

/** Структурный режим: скелет — дайджест с адресами частей для `insert_node`. */
export const describeComponentTool = createDescribeComponentTool({
  skeleton: 'outline',
  budget: TOOL_TEXT_BUDGET,
  inspect: 'inspect an existing node with get_form_node',
});
